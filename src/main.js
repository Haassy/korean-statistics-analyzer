
import { Actor } from 'apify';
import { 
    createKosisApiClient, 
    getStatsList, 
    getMetaInfo, 
    getStatsData, 
    normalizeStatisticalData,
    validateInput,
    sleep,
    logProgress,
    logEvent,
    KOSIS_VIEW_CODES
} from './utils.js';

// Function to render a chart
async function renderChart(data) {
    const { Chart } = await import('chart.js');

    const canvas = await Actor.openCanvas();
    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.STAT_NAME),
            datasets: [{
                label: 'Value',
                data: data.map(item => item.DT),
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    const chartImage = await canvas.toBuffer('image/png');
    await Actor.setValue('chart.png', chartImage, { contentType: 'image/png' });
}

export async function mainLogic() {
    logEvent('actor.started');
    // Get input parameters
    const input = await Actor.getInput();
    logProgress('Actor started', { input });

    // Validate input parameters
    const validatedInput = validateInput(input || {});
    logProgress('Input validated', validatedInput);

    // Get KOSIS API credentials
    const kosisApiKey = process.env.KOSIS_API_KEY || await Actor.getValue('KOSIS_API_KEY');
    
    if (!kosisApiKey) {
        // Demo mode - provide sample data when no API key is available
        logEvent('actor.demo_mode');
        logProgress('Running in demo mode - no KOSIS API key provided');
        await runDemoMode(validatedInput);
        logEvent('actor.completed', { mode: 'demo' });
        return;
    }

    try {
        // Create API client
        const apiClient = createKosisApiClient(kosisApiKey);
        logProgress('KOSIS API client created');

        // Build search parameters
        const searchParams = buildSearchParams(validatedInput);
        logProgress('Search parameters built', searchParams);

        // Get list of statistical tables
        logEvent('api.call_initiated', { api: 'getStatsList', params: searchParams });
        logProgress('Fetching statistical tables list...');
        const statsList = await getStatsList(apiClient, searchParams);
        logEvent('api.call_successful', { api: 'getStatsList', resultCount: statsList.length });
        logProgress(`Found ${statsList.length} statistical tables`);

        if (statsList.length === 0) {
            logProgress('No statistical tables found for the given criteria');
            await Actor.pushData({
                message: 'No statistical tables found for the given search criteria',
                searchParams: searchParams,
                extractedAt: new Date().toISOString()
            });
            logEvent('actor.completed', { mode: 'api', status: 'no_data' });
            return;
        }

        // Process each statistical table (up to maxItems)
        const tablesToProcess = statsList.slice(0, validatedInput.maxItems);
        logProgress(`Processing ${tablesToProcess.length} tables`);

        let totalDataPoints = 0;
        let processedTables = 0;
        let allNormalizedData = [];

        for (const table of tablesToProcess) {
            try {
                processedTables++;
                const tableId = table.TBL_ID || table.LIST_ID || `table_${processedTables}`;
                const tableTitle = table.TBL_NM || table.LIST_NM || 'Unknown Table';
                
                logEvent('table.processing_started', { tableId: tableId, title: tableTitle });
                logProgress(`Processing table ${processedTables}/${tablesToProcess.length}: ${tableTitle}`, {
                    tableId: tableId,
                    title: tableTitle
                });

                // Get metadata if requested
                let metadata = null;
                if (validatedInput.includeMetadata) {
                    try {
                        logEvent('api.call_initiated', { api: 'getMetaInfo', tableId: tableId });
                        metadata = await getMetaInfo(apiClient, tableId);
                        logEvent('api.call_successful', { api: 'getMetaInfo', tableId: tableId });
                        logProgress('Metadata retrieved');
                    } catch (metaError) {
                        logEvent('api.call_failed', { api: 'getMetaInfo', tableId: tableId, error: metaError.message });
                        logProgress('Warning: Could not retrieve metadata', { error: metaError.message });
                    }
                }

                // Get statistical data
                logEvent('api.call_initiated', { api: 'getStatsData', tableId: tableId });
                const statsParams = {
                    orgId: table.ORG_ID || '101',
                    objL1: 'ALL',
                    itmId: 'T1',
                    prdSe: 'Y',
                    newEstPrdCnt: '5'
                };
                const statsData = await getStatsData(apiClient, tableId, statsParams);
                logEvent('api.call_successful', { api: 'getStatsData', tableId: tableId });
                logProgress('Statistical data retrieved');

                // Process output format
                if (validatedInput.outputFormat === 'raw' || validatedInput.outputFormat === 'both') {
                    await Actor.pushData({
                        type: 'raw',
                        tableId: tableId,
                        tableInfo: table,
                        metadata: metadata,
                        rawData: statsData,
                        extractedAt: new Date().toISOString()
                    });
                }

                if (validatedInput.outputFormat === 'structured' || validatedInput.outputFormat === 'both') {
                    const normalizedData = normalizeStatisticalData(statsData, metadata, tableId);
                    allNormalizedData.push(...normalizedData);
                    for (const dataPoint of normalizedData) {
                        await Actor.pushData(dataPoint);
                        totalDataPoints++;
                    }
                    logProgress(`Processed ${normalizedData.length} data points from table`);
                }

                logEvent('table.processing_successful', { tableId: tableId });
                // Rate limiting - wait between requests
                await sleep(validatedInput.delayBetweenRequests);

            } catch (tableError) {
                const tableId = table.TBL_ID || table.LIST_ID || `table_${processedTables}`;
                const tableTitle = table.TBL_NM || table.LIST_NM || 'Unknown Table';
                
                logEvent('table.processing_failed', { tableId: tableId, error: tableError.message });
                logProgress(`Error processing table ${tableId}`, { 
                    error: tableError.message,
                    tableTitle: tableTitle 
                });
                
                await Actor.pushData({
                    type: 'error',
                    tableId: tableId,
                    tableTitle: tableTitle,
                    error: tableError.message,
                    extractedAt: new Date().toISOString()
                });
            }
        }

        // Render chart if data is available
        if (allNormalizedData.length > 0) {
            await renderChart(allNormalizedData);
        }

        // Final summary
        logProgress('Processing completed', {
            tablesProcessed: processedTables,
            totalDataPoints: totalDataPoints,
            searchCriteria: validatedInput
        });

        await Actor.pushData({
            type: 'summary',
            tablesProcessed: processedTables,
            totalDataPoints: totalDataPoints,
            searchCriteria: validatedInput,
            completedAt: new Date().toISOString()
        });
        logEvent('actor.completed', { mode: 'api', status: 'success', tablesProcessed: processedTables, totalDataPoints });

    } catch (error) {
        logEvent('api.call_failed', { error: error.message });
        logProgress('API error occurred, falling back to demo mode', { error: error.message });
        
        if (error.message.includes('403') || error.message.includes('401') || error.message.includes('API')) {
            logProgress('Falling back to demo mode due to API authentication issues');
            await runDemoMode(validatedInput);
            logEvent('actor.completed', { mode: 'demo', status: 'fallback' });
            return;
        }
        
        await Actor.pushData({
            type: 'error',
            error: error.message,
            message: 'An error occurred while processing. Falling back to demo mode.',
            input: validatedInput,
            extractedAt: new Date().toISOString()
        });
        
        await runDemoMode(validatedInput);
        logEvent('actor.completed', { mode: 'demo', status: 'error_fallback' });
    }
}

function buildSearchParams(input) {
    const params = {
        vwCd: input.vwCd || 'MT_ZTITLE',
        parentId: input.parentId || 'A'
    };
    
    // Add search keyword if provided
    if (input.searchKeyword) {
        // KOSIS doesn't have direct keyword search in statisticsList
        // We'll filter results after retrieval
        params.searchKeyword = input.searchKeyword;
    }
    
    return params;
}

async function runDemoMode(input) {
    logProgress('Generating demo data for Korean Government Statistics Analyzer');
    const demoData = [
        {
            statName: '인구총조사 총인구',
            surveyDate: '2020년',
            region: '전국',
            category1: '총인구',
            category2: '계',
            value: 51829023,
            unit: '명',
            sourceTableId: 'demo_001',
            dataType: 'population',
            lastUpdated: '2021-08-31T00:00:00Z',
            metadata: { 
                tableTitle: '인구총조사 총인구', 
                categories: { area: '전국', gender: '계' }, 
                note: 'This is demo data for Korean statistics' 
            },
            extractedAt: new Date().toISOString()
        },
        {
            statName: '경제활동인구조사 취업자수',
            surveyDate: '2023년 12월',
            region: '전국',
            category1: '취업자',
            category2: '전체',
            value: 28432000,
            unit: '명',
            sourceTableId: 'demo_002',
            dataType: 'labor',
            lastUpdated: '2024-01-15T00:00:00Z',
            metadata: { 
                tableTitle: '경제활동인구조사 취업자수', 
                categories: { area: '전국', employment: '취업자' }, 
                note: 'This is demo data for Korean statistics' 
            },
            extractedAt: new Date().toISOString()
        },
        {
            statName: '국내총생산(GDP)',
            surveyDate: '2023년',
            region: '전국',
            category1: '실질GDP',
            category2: '연간',
            value: 2080000,
            unit: '십억원',
            sourceTableId: 'demo_003',
            dataType: 'economic',
            lastUpdated: '2024-03-26T00:00:00Z',
            metadata: { 
                tableTitle: '국내총생산(GDP)', 
                categories: { type: '실질GDP', period: '연간' }, 
                note: 'This is demo data for Korean statistics' 
            },
            extractedAt: new Date().toISOString()
        },
        {
            statName: '소비자물가지수',
            surveyDate: '2024년 8월',
            region: '전국',
            category1: '총지수',
            category2: '전월대비',
            value: 102.3,
            unit: '지수',
            sourceTableId: 'demo_004',
            dataType: 'prices',
            lastUpdated: '2024-09-01T00:00:00Z',
            metadata: { 
                tableTitle: '소비자물가지수', 
                categories: { type: '총지수', comparison: '전월대비' }, 
                note: 'This is demo data for Korean statistics' 
            },
            extractedAt: new Date().toISOString()
        }
    ];

    let filteredData = demoData;
    if (input.searchKeyword) {
        const keyword = input.searchKeyword.toLowerCase();
        filteredData = filteredData.filter(item => 
            item.statName.toLowerCase().includes(keyword) ||
            item.category1.toLowerCase().includes(keyword) ||
            item.dataType.toLowerCase().includes(keyword)
        );
    }
    filteredData = filteredData.slice(0, input.maxItems);

    for (const dataPoint of filteredData) {
        await Actor.pushData(dataPoint);
    }

    await Actor.pushData({
        type: 'demo_summary',
        message: 'Demo mode completed. To access real KOSIS data, please provide KOSIS_API_KEY.',
        demoDataPoints: filteredData.length,
        searchCriteria: input,
        registrationInfo: { 
            url: 'https://kosis.kr/openapi/index/index.jsp', 
            note: 'Register for KOSIS API access (Korean phone number or i-PIN required)',
            warning: 'KOSIS API key registration requires Korean identity verification'
        },
        completedAt: new Date().toISOString()
    });

    logProgress('Demo mode completed', { dataPoints: filteredData.length, searchKeyword: input.searchKeyword });
}

if (process.env.NODE_ENV !== 'test') {
    Actor.main(mainLogic);
}

