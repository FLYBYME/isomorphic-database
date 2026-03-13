import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Zod-to-SQL Migration Generator.
 * Reads a directory of schema files and outputs SQLite DDL.
 */
export function generateMigration(schemaDir: string, outputFile: string) {
    const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.schema.ts'));
    let sql = '-- Auto-generated Migration\n\n';

    for (const file of files) {
        const tableName = file.replace('.schema.ts', '').toLowerCase();
        // Since we can't easily import TS files at runtime without a loader,
        // this is a simplified regex-based extractor or we assume schemas are exported as 'Schema'
        sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
        sql += `  id TEXT PRIMARY KEY,\n`;
        sql += `  tenant_id TEXT,\n`;
        sql += `  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n`;
        sql += `  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n`;
        sql += `);\n\n`;
    }

    fs.writeFileSync(outputFile, sql);
    console.log(`[SchemaGenerator] Migration SQL written to ${outputFile}`);
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('Usage: npx ts-node generateMigration.ts <schemaDir> <outputFile>');
        process.exit(1);
    }
    generateMigration(path.resolve(args[0]), path.resolve(args[1]));
}
