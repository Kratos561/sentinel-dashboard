const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = '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';
const OWNER = 'Kratos561';
const NEW_REPO_NAME = 'sentinel-dashboard-backup-v10';
const BRANCH = 'main';

function githubAPI(method, apiPath, body = null, token) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: 'api.github.com', port: 443, path: apiPath, method,
            headers: { 'Authorization': `token ${token}`, 'User-Agent': 'Sentinel-Backup-Agent', 'Accept': 'application/vnd.github.v3+json' }
        };
        if (body) opts.headers['Content-Type'] = 'application/json';
        const req = https.request(opts, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
                catch (e) { resolve({ status: res.statusCode, data: d }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === 'dist' || file === '.git' || file === 'package-lock.json') continue;
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getFiles(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    }
    return fileList;
}

(async () => {
    try {
        console.log(`Creando repositorio privado: ${NEW_REPO_NAME}...`);

        let repoRes = await githubAPI('POST', `/user/repos`, {
            name: NEW_REPO_NAME,
            description: "Backup definitivo estructurado del Sentinel Dashboard React (V10 HFT)",
            private: true,
            auto_init: true // creates main branch with README
        }, GITHUB_TOKEN);

        if (repoRes.status !== 201 && repoRes.status !== 422) {
            console.log("Error creando repo:", repoRes.data.message);
            return;
        }

        if (repoRes.status === 422) {
            console.log("El repo ya existe, procediendo a actualizar los archivos...");
        } else {
            console.log("✅ Repo creado correctamente!");
            // Wait for initialization
            await new Promise(r => setTimeout(r, 4000));
        }

        let refRes = await githubAPI('GET', `/repos/${OWNER}/${NEW_REPO_NAME}/git/refs/heads/${BRANCH}`, null, GITHUB_TOKEN);
        if (refRes.status !== 200) {
            console.log("Error getting branch ref", refRes.data.message);
            return;
        }

        const latestCommitSha = refRes.data.object.sha;
        const commitRes = await githubAPI('GET', `/repos/${OWNER}/${NEW_REPO_NAME}/git/commits/${latestCommitSha}`, null, GITHUB_TOKEN);
        const baseTreeSha = commitRes.data.tree.sha;

        const allFiles = getFiles('./');
        const tree = [];

        console.log(`Subiendo ${allFiles.length} archivos como blobs (esto puede tardar unos segundos)...`);
        let count = 0;
        for (const f of allFiles) {
            if (f.endsWith('backup_dashboard.js')) continue; // Don't backup this script

            const relativePath = path.relative('./', f).replace(/\\/g, '/');
            const content = fs.readFileSync(f).toString('base64');

            const blobRes = await githubAPI('POST', `/repos/${OWNER}/${NEW_REPO_NAME}/git/blobs`, {
                content: content,
                encoding: 'base64'
            }, GITHUB_TOKEN);

            if (blobRes.status !== 201) {
                console.error(`❌ Failed blob: ${relativePath}`, blobRes.data?.message);
                continue;
            }

            tree.push({
                path: relativePath,
                mode: '100644',
                type: 'blob',
                sha: blobRes.data.sha
            });
            count++;
            if (count % 5 === 0) console.log(`  Uploaded ${count}/${allFiles.length} archivos...`);
        }

        console.log("Construyendo el árbol del proyecto (Tree Map)...");
        const treeRes = await githubAPI('POST', `/repos/${OWNER}/${NEW_REPO_NAME}/git/trees`, {
            base_tree: baseTreeSha,
            tree: tree
        }, GITHUB_TOKEN);

        const newTreeSha = treeRes.data.sha;
        console.log("Inyectando el Backup Commit...");

        const newCommitRes = await githubAPI('POST', `/repos/${OWNER}/${NEW_REPO_NAME}/git/commits`, {
            message: "backup: Sentinel Quantum Dashboard React Source Code FULL BACKUP",
            tree: newTreeSha,
            parents: [latestCommitSha]
        }, GITHUB_TOKEN);

        const newCommitSha = newCommitRes.data.sha;
        console.log("Asignando HEAD a main...");

        const updateRefRes = await githubAPI('PATCH', `/repos/${OWNER}/${NEW_REPO_NAME}/git/refs/heads/${BRANCH}`, {
            sha: newCommitSha,
            force: true
        }, GITHUB_TOKEN);

        if (updateRefRes.status === 200) {
            console.log(`✅ ¡BACKUP CLOUD TOTAL COMPLETADO A PRUEBA DE BALAS!`);
            console.log(`🔐 URL Privada: https://github.com/${OWNER}/${NEW_REPO_NAME}`);
        } else {
            console.log("⚠️ Falló la actualización final del branch:", updateRefRes.data.message);
        }

    } catch (e) { console.error(e); }
})();
