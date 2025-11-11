import { db } from '../config/database';
import path from 'path';
import fs from 'fs/promises';

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

class MigrationRunner {
  private migrationsPath: string;

  constructor() {
    this.migrationsPath = path.join(__dirname, '../migrations');
  }

  async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await db.query(sql);
  }

  async getExecutedMigrations(): Promise<string[]> {
    const sql = 'SELECT filename FROM migrations ORDER BY id';
    const results = await db.query(sql);
    return results.map(row => row.filename);
  }

  async loadMigrationFiles(): Promise<Migration[]> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const sqlFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure consistent order

      const migrations: Migration[] = [];
      
      for (const file of sqlFiles) {
        const filePath = path.join(this.migrationsPath, file);
        const sql = await fs.readFile(filePath, 'utf-8');
        
        migrations.push({
          id: file.replace('.sql', ''),
          filename: file,
          sql: sql.trim(),
        });
      }

      return migrations;
    } catch (error) {
      throw new Error(`Failed to load migration files: ${error}`);
    }
  }

  async executeMigration(migration: Migration): Promise<void> {
    await db.transaction(async (client) => {
      // Execute the migration SQL
      await client.query(migration.sql);
      
      // Record the migration
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [migration.filename]
      );
    });
    
    console.log(`✅ Executed migration: ${migration.filename}`);
  }

  async migrate(): Promise<void> {
    try {
      console.log('🔄 Starting database migration...');
      
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();
      
      // Get executed migrations
      const executedMigrations = await this.getExecutedMigrations();
      
      // Load all migration files
      const allMigrations = await this.loadMigrationFiles();
      
      // Filter out already executed migrations
      const pendingMigrations = allMigrations.filter(
        migration => !executedMigrations.includes(migration.filename)
      );
      
      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations to execute');
        return;
      }
      
      console.log(`📋 Found ${pendingMigrations.length} pending migrations`);
      
      // Execute pending migrations
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }
      
      console.log('🎉 Migration completed successfully');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async rollback(steps: number = 1): Promise<void> {
    try {
      console.log(`🔄 Rolling back ${steps} migration(s)...`);
      
      const sql = `
        SELECT filename 
        FROM migrations 
        ORDER BY id DESC 
        LIMIT $1
      `;
      
      const migrations = await db.query(sql, [steps]);
      
      if (migrations.length === 0) {
        console.log('✅ No migrations to rollback');
        return;
      }
      
      for (const migration of migrations) {
        // Remove migration record
        await db.query(
          'DELETE FROM migrations WHERE filename = $1',
          [migration.filename]
        );
        
        console.log(`↩️ Rolled back migration: ${migration.filename}`);
      }
      
      console.log('🎉 Rollback completed successfully');
      
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  async status(): Promise<void> {
    try {
      console.log('📊 Migration status:');
      
      const executedMigrations = await this.getExecutedMigrations();
      const allMigrations = await this.loadMigrationFiles();
      
      console.log(`\n📋 Total migrations: ${allMigrations.length}`);
      console.log(`✅ Executed migrations: ${executedMigrations.length}`);
      console.log(`⏳ Pending migrations: ${allMigrations.length - executedMigrations.length}`);
      
      const pendingMigrations = allMigrations.filter(
        migration => !executedMigrations.includes(migration.filename)
      );
      
      if (pendingMigrations.length > 0) {
        console.log('\n⏳ Pending migrations:');
        pendingMigrations.forEach(migration => {
          console.log(`  - ${migration.filename}`);
        });
      }
      
      if (executedMigrations.length > 0) {
        console.log('\n✅ Executed migrations:');
        executedMigrations.forEach(filename => {
          console.log(`  - ${filename}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to get migration status:', error);
      throw error;
    }
  }
}

// CLI interface
async function main(): Promise<void> {
  const command = process.argv[2];
  const steps = parseInt(process.argv[3] || '1');
  
  const runner = new MigrationRunner();
  
  try {
    switch (command) {
      case 'migrate':
        await runner.migrate();
        break;
      case 'rollback':
        await runner.rollback(steps);
        break;
      case 'status':
        await runner.status();
        break;
      default:
        console.log('Usage:');
        console.log('  node migrate.js migrate     - Run pending migrations');
        console.log('  node migrate.js rollback [n] - Rollback n migrations (default: 1)');
        console.log('  node migrate.js status     - Show migration status');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration command failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { MigrationRunner };