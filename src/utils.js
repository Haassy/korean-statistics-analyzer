import axios from 'axios';

const KOSIS_BASE_URL = 'https://kosis.kr/openapi';

const createApiClient = (apiKey) => {
    return axios.create({
        baseURL: KOSIS_BASE_URL,
        timeout: 30000,
        params: {
            apiKey: apiKey,
            format: 'json'
        }
    });
};

const handleApiError = (error, context) => {
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const { status, data } = error.response;
        const apiErrorMsg = data?.message || data?.error || 'Unknown API error';
        throw new Error(`KOSIS API Error (${context}): Status ${status} - ${apiErrorMsg}`);
    } else if (error.request) {
        // The request was made but no response was received
        throw new Error(`KOSIS API Error (${context}): No response received from server.`);
    } else {
        // Something happened in setting up the request that triggered an Error
        throw new Error(`KOSIS API Error (${context}): ${error.message}`);
    }
};

export const getStatsList = async (apiClient, params = {}) => {
    try {
        const response = await apiClient.get('/statisticsList.do', {
            params: {
                method: 'getList',
                vwCd: params.vwCd || 'MT_ZTITLE', // Default to domestic statistics by topic
                parentId: params.parentId || 'A',
                ...params
            }
        });

        if (response.data && Array.isArray(response.data)) {
            return response.data;
        } else if (response.data && response.data.length !== undefined) {
            return response.data;
        } else {
            throw new Error('Invalid response format from KOSIS API');
        }
    } catch (error) {
        handleApiError(error, 'getStatsList');
    }
};

export const getMetaInfo = async (apiClient, statsDataId) => {
    // KOSIS doesn't have a direct equivalent to e-Stat's getMetaInfo
    // Return basic metadata structure for compatibility
    return {
        tableId: statsDataId,
        note: 'Metadata retrieved from KOSIS API',
        lastUpdated: new Date().toISOString()
    };
};

export const getStatsData = async (apiClient, tableId, params = {}) => {
    try {
        // Use the parameter-based method for more flexibility
        const response = await apiClient.get('/Param/statisticsParameterData.do', {
            params: {
                method: 'getList',
                orgId: params.orgId || '101', // Default to Statistics Korea
                tblId: tableId,
                objL1: params.objL1 || 'ALL', // First classification
                itmId: params.itmId || 'T1', // Item ID
                prdSe: params.prdSe || 'Y', // Period (Y=yearly, M=monthly, Q=quarterly)
                newEstPrdCnt: params.newEstPrdCnt || '5', // Get latest 5 periods
                ...params
            }
        });

        if (response.data && Array.isArray(response.data)) {
            return response.data;
        } else {
            throw new Error('Invalid response format from KOSIS API');
        }
    } catch (error) {
        handleApiError(error, `getStatsData for ${tableId}`);
    }
};

export const normalizeStatisticalData = (rawData, metadata, sourceTableId) => {
    const normalizedData = [];
    
    try {
        if (!Array.isArray(rawData)) {
            rawData = [rawData];
        }

        rawData.forEach(item => {
            // KOSIS API returns data in a different format
            const statName = item.TBL_NM || 'Unknown Statistic';
            const value = parseFloat(item.DT) || 0;
            const unit = item.UNIT_NM || '';
            const period = item.PRD_DE || 'Unknown Period';
            
            // Extract categories from classification fields
            const category1 = item.C1_NM || item.ITM_NM || 'General';
            const category2 = item.C2_NM || '';
            const region = item.C1_NM && item.C1_NM.includes('지역') ? item.C1_NM : 'Korea';

            normalizedData.push({
                statName,
                surveyDate: period,
                region,
                category1,
                category2,
                value,
                unit,
                sourceTableId,
                dataType: determineDataType(statName),
                lastUpdated: item.LST_CHN_DE || new Date().toISOString(),
                metadata: {
                    tableTitle: statName,
                    categories: {
                        c1: item.C1_NM,
                        c2: item.C2_NM,
                        c3: item.C3_NM,
                        item: item.ITM_NM
                    },
                    originalData: item
                },
                extractedAt: new Date().toISOString()
            });
        });
    } catch (error) {
        console.error('Error normalizing KOSIS data:', error.message);
        normalizedData.push({
            statName: 'Error Processing Data',
            surveyDate: 'Unknown Date',
            region: 'Korea',
            category1: 'Error',
            category2: '',
            value: 0,
            unit: '',
            sourceTableId,
            dataType: 'error',
            lastUpdated: new Date().toISOString(),
            metadata: { error: error.message, rawData },
            extractedAt: new Date().toISOString()
        });
    }

    return normalizedData;
};

const determineDataType = (statName) => {
    const name = statName.toLowerCase();
    
    // Korean keywords
    if (name.includes('인구') || name.includes('population')) return 'population';
    if (name.includes('경제') || name.includes('gdp') || name.includes('경제성장')) return 'economic';
    if (name.includes('노동') || name.includes('고용') || name.includes('취업')) return 'labor';
    if (name.includes('산업') || name.includes('제조업')) return 'industry';
    if (name.includes('교육') || name.includes('학교')) return 'education';
    if (name.includes('의료') || name.includes('보건') || name.includes('건강')) return 'health';
    if (name.includes('환경') || name.includes('오염')) return 'environment';
    if (name.includes('주택') || name.includes('부동산')) return 'housing';
    if (name.includes('소득') || name.includes('소비') || name.includes('가계')) return 'income';
    if (name.includes('물가') || name.includes('가격')) return 'prices';
    
    return 'general';
};

export const validateInput = (input) => {
    const validated = {
        searchKeyword: input.searchKeyword?.trim() || '',
        vwCd: input.vwCd?.trim() || 'MT_ZTITLE', // Service view code
        parentId: input.parentId?.trim() || 'A',
        maxItems: Math.min(Math.max(parseInt(input.maxItems) || 10, 1), 100),
        includeMetadata: Boolean(input.includeMetadata !== false),
        outputFormat: ['structured', 'raw', 'both'].includes(input.outputFormat) ? input.outputFormat : 'structured',
        delayBetweenRequests: Math.max(parseInt(input.delayBetweenRequests) || 1000, 500)
    };

    return validated;
};

export const createKosisApiClient = (apiKey) => {
    if (!apiKey) {
        throw new Error('KOSIS API Key is required. Please set KOSIS_API_KEY environment variable.');
    }
    
    return createApiClient(apiKey);
};

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const logProgress = (message, data = {}) => {
    console.log(`[${new Date().toISOString()}] ${message}`, data);
};

/**
 * Log a monitoring event.
 * @param {string} eventName - The name of the event.
 * @param {Object} data - Additional data associated with the event.
 */
export const logEvent = (eventName, data = {}) => {
    const event = {
        event: eventName,
        timestamp: new Date().toISOString(),
        ...data,
    };
    console.log(`[MONITORING] ${JSON.stringify(event)}`);
};

// Service view codes for KOSIS
export const KOSIS_VIEW_CODES = {
    DOMESTIC_TOPIC: 'MT_ZTITLE',      // 국내통계 주제별
    DOMESTIC_AGENCY: 'MT_OTITLE',     // 국내통계 기관별
    LOCAL_TOPIC: 'MT_GTITLE01',       // e-지방지표(주제별)
    LOCAL_REGION: 'MT_GTITLE02',      // e-지방지표(지역별)
    HISTORICAL: 'MT_CHOSUN_TITLE',    // 광복이전통계(1908~1943)
    YEARBOOK: 'MT_HANKUK_TITLE',      // 대한민국통계연감
    DISCONTINUED: 'MT_STOP_TITLE',    // 작성중지통계
    INTERNATIONAL: 'MT_RTITLE',       // 국제통계
    NORTH_KOREA: 'MT_BUKHAN',         // 북한통계
    TARGET_BASED: 'MT_TM1_TITLE',     // 대상별통계
    ISSUE_BASED: 'MT_TM2_TITLE',      // 이슈별통계
    ENGLISH: 'MT_ETITLE'              // 영문 KOSIS
};
