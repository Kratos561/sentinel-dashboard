import { connect } from '@tidbcloud/serverless'

// Configured for local dashboard use only. It uses the HTTPS Data API wrapper.
export const tidb = connect({
    url: 'mysql://2XzHcTgKE7J9zJ1.root:ydKrzSBOTax011sx@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/sentinel_hft',
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        let url = input.toString();
        if (url.includes('https://http-gateway01.us-east-1.prod.aws.tidbcloud.com')) {
            url = url.replace('https://http-gateway01.us-east-1.prod.aws.tidbcloud.com', '/api/tidb');
        }
        return fetch(url, init);
    }
});
