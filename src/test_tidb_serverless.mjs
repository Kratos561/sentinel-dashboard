import { connect } from '@tidbcloud/serverless';

const tidb = connect({
    url: 'mysql://2XzHcTgKE7J9zJ1.root:ydKrzSBOTax011sx@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/sentinel_hft'
});

async function main() {
    try {
        const data = await tidb.execute(`SELECT price, recorded_at FROM ghost_prices WHERE symbol = 'NASDAQ100' ORDER BY recorded_at DESC LIMIT 5`);
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
main();
