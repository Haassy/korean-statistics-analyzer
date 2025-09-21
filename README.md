# Korean Government Statistics Analyzer

Extract and analyze comprehensive statistical data from Korea's KOSIS (Korean Statistical Information Service) portal. This Apify Actor provides automated access to official Korean government statistics with structured data output.

## 🇰🇷 About KOSIS

KOSIS (Korean Statistical Information Service) is the official statistical portal operated by Statistics Korea, providing access to comprehensive government statistics including:

- Population and demographics
- Economic indicators (GDP, inflation, trade)
- Labor market statistics
- Industrial production data
- Social indicators (education, health, housing)
- Regional statistics
- Historical data (1908-1943)

## ✨ Features

- **Comprehensive Data Access**: Extract data from multiple statistical categories
- **Flexible Search**: Search by keywords, categories, or specific statistical tables
- **Multiple Output Formats**: Choose between structured, raw, or combined data formats
- **Demo Mode**: Test functionality without API credentials
- **Rate Limiting**: Built-in delays to respect API limits
- **Error Handling**: Robust error handling with fallback to demo mode
- **Metadata Support**: Optional inclusion of detailed metadata

## 🚀 Quick Start

### Basic Usage

```json
{
  "searchKeyword": "인구",
  "maxItems": 5,
  "outputFormat": "structured"
}
```

### Advanced Configuration

```json
{
  "searchKeyword": "경제성장",
  "vwCd": "MT_ZTITLE",
  "parentId": "A",
  "maxItems": 10,
  "includeMetadata": true,
  "outputFormat": "both",
  "delayBetweenRequests": 2000
}
```

## 📋 Input Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `searchKeyword` | string | `""` | Search keyword for filtering statistics (Korean or English) |
| `vwCd` | string | `"MT_ZTITLE"` | Service view code (see View Codes section) |
| `parentId` | string | `"A"` | Parent category ID for hierarchical browsing |
| `maxItems` | number | `10` | Maximum number of statistical tables to process (1-100) |
| `includeMetadata` | boolean | `true` | Include detailed metadata in output |
| `outputFormat` | string | `"structured"` | Output format: `"structured"`, `"raw"`, or `"both"` |
| `delayBetweenRequests` | number | `1000` | Delay between API requests in milliseconds (min: 500) |

## 🏷️ KOSIS View Codes

| Code | Description | Korean Name |
|------|-------------|-------------|
| `MT_ZTITLE` | Domestic Statistics (by Topic) | 국내통계 주제별 |
| `MT_OTITLE` | Domestic Statistics (by Agency) | 국내통계 기관별 |
| `MT_GTITLE01` | Local Indicators (by Topic) | e-지방지표(주제별) |
| `MT_GTITLE02` | Local Indicators (by Region) | e-지방지표(지역별) |
| `MT_CHOSUN_TITLE` | Historical Statistics (1908-1943) | 광복이전통계 |
| `MT_HANKUK_TITLE` | Korea Statistical Yearbook | 대한민국통계연감 |
| `MT_RTITLE` | International Statistics | 국제통계 |
| `MT_BUKHAN` | North Korea Statistics | 북한통계 |
| `MT_ETITLE` | English KOSIS | 영문 KOSIS |

## 📊 Output Data Structure

### Structured Output

```json
{
  "statName": "인구총조사 총인구",
  "surveyDate": "2020년",
  "region": "전국",
  "category1": "총인구",
  "category2": "계",
  "value": 51829023,
  "unit": "명",
  "sourceTableId": "DT_1IN1502",
  "dataType": "population",
  "lastUpdated": "2021-08-31T00:00:00Z",
  "metadata": {
    "tableTitle": "인구총조사 총인구",
    "categories": {
      "c1": "전국",
      "c2": "계",
      "item": "총인구"
    },
    "originalData": { ... }
  },
  "extractedAt": "2024-09-21T10:30:00Z"
}
```

### Data Types

The Actor automatically categorizes statistics into the following types:

- `population` - Population and demographic data
- `economic` - Economic indicators (GDP, growth, etc.)
- `labor` - Employment and labor market statistics
- `industry` - Industrial production and manufacturing
- `education` - Educational statistics
- `health` - Healthcare and medical statistics
- `environment` - Environmental indicators
- `housing` - Housing and real estate data
- `income` - Income and household statistics
- `prices` - Price indices and inflation data
- `general` - Other statistical categories

## 🔑 API Key Setup

### Option 1: Environment Variable (Recommended)
Set the `KOSIS_API_KEY` environment variable in your Apify Actor settings.

### Option 2: Actor Input
Include your API key in the Actor input (less secure):

```json
{
  "apiKey": "your-kosis-api-key-here",
  "searchKeyword": "인구"
}
```

### Getting a KOSIS API Key

⚠️ **Important**: KOSIS API key registration requires Korean identity verification.

1. Visit [KOSIS OpenAPI Registration](https://kosis.kr/openapi/index/index.jsp)
2. Click "인증키 신청" (API Key Application)
3. Complete identity verification using:
   - Korean mobile phone number, OR
   - i-PIN (Korean digital identity)
4. Fill out the application form
5. Wait for approval (usually 1-2 business days)

**Note**: International users without Korean identity verification cannot obtain KOSIS API keys. The Actor will run in demo mode without an API key.

## 🎯 Use Cases

### Research and Analysis
- Academic research on Korean demographics and economics
- Market research and business intelligence
- Policy analysis and government studies
- International comparative studies

### Data Integration
- Integrate Korean statistics into dashboards
- Automated data collection for reports
- Real-time monitoring of economic indicators
- Historical trend analysis

### Business Applications
- Market sizing and opportunity analysis
- Economic forecasting and planning
- Competitive intelligence
- Investment research

## 📈 Example Searches

### Population Statistics
```json
{
  "searchKeyword": "인구",
  "vwCd": "MT_ZTITLE",
  "maxItems": 5
}
```

### Economic Indicators
```json
{
  "searchKeyword": "GDP",
  "vwCd": "MT_ZTITLE",
  "maxItems": 3
}
```

### Labor Market Data
```json
{
  "searchKeyword": "고용",
  "vwCd": "MT_ZTITLE",
  "maxItems": 8
}
```

### Regional Statistics
```json
{
  "vwCd": "MT_GTITLE02",
  "parentId": "A",
  "maxItems": 10
}
```

## 🛠️ Technical Details

- **Runtime**: Node.js 18+
- **Dependencies**: Apify SDK, Axios
- **Rate Limiting**: Configurable delays between requests
- **Error Handling**: Automatic fallback to demo mode
- **Data Validation**: Input validation and sanitization
- **Monitoring**: Comprehensive logging and event tracking

## 📝 Demo Mode

When no API key is provided, the Actor runs in demo mode with sample Korean statistical data:

- Population census data
- Employment statistics
- GDP figures
- Consumer price index

Demo mode is perfect for:
- Testing the Actor functionality
- Understanding output formats
- Development and integration testing

## 🔍 Troubleshooting

### Common Issues

1. **No API Key**: Actor runs in demo mode
   - Solution: Obtain KOSIS API key or use demo data

2. **API Authentication Error**: 403/401 responses
   - Solution: Verify API key validity and permissions

3. **No Data Found**: Empty results
   - Solution: Adjust search parameters or view codes

4. **Rate Limiting**: Too many requests
   - Solution: Increase `delayBetweenRequests` parameter

### Support

For technical issues or questions:
- Check the Actor logs for detailed error messages
- Verify input parameters match the expected format
- Ensure API key has proper permissions
- Contact support through Apify platform

## 📄 License

This project is licensed under the Apache License 2.0.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

---

**Disclaimer**: This Actor is not officially affiliated with Statistics Korea or KOSIS. It provides a convenient interface to access publicly available statistical data through official APIs.
