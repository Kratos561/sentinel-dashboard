import { connect } from '@tidbcloud/serverless'

// Configured for Vercel Edge proxy
export const tidb = connect({
    url: 'mysql://2XzHcTgKE7J9zJ1.root:ydKrzSBOTax011sx@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/sentinel_hft',
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        let url = input.toString();
        // The driver asks for https://http-gateway01.us-east-1.prod.aws.tidbcloud.com/v1beta/sql
        // We proxy it through Vercel as /api/tidb/v1beta/sql
        if (url.includes('https://http-gateway01.us-east-1.prod.aws.tidbcloud.com')) {
            url = url.replace('https://http-gateway01.us-east-1.prod.aws.tidbcloud.com', '/api/tidb');
        }
        return fetch(url, { ...init, cache: 'no-store' });
    }
});
