import { db } from '../config/database';
import { authService } from '../services/auth.service';
import { v4 as uuidv4 } from 'uuid';

async function seedAuth(): Promise<void> {
  try {
    console.log('🌱 Starting auth data seeding...');

    // Seed system roles
    const roles = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'org_admin',
        level: 'org',
        permissions: JSON.stringify(['org:create', 'org:read', 'org:update', 'org:delete', 'org:manage_members', 'workspace:create']),
        description: 'Organization administrator with full control',
        is_system: true,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'org_member',
        level: 'org',
        permissions: JSON.stringify(['org:read', 'workspace:read', 'team:read']),
        description: 'Regular organization member',
        is_system: true,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'workspace_admin',
        level: 'workspace',
        permissions: JSON.stringify(['workspace:read', 'workspace:update', 'workspace:manage_members', 'team:create', 'team:read']),
        description: 'Workspace administrator',
        is_system: true,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        name: 'workspace_member',
        level: 'workspace',
        permissions: JSON.stringify(['workspace:read', 'team:read']),
        description: 'Regular workspace member',
        is_system: true,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440005',
        name: 'team_admin',
        level: 'team',
        permissions: JSON.stringify(['team:read', 'team:update', 'team:manage_members']),
        description: 'Team administrator',
        is_system: true,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440006',
        name: 'team_member',
        level: 'team',
        permissions: JSON.stringify(['team:read']),
        description: 'Regular team member',
        is_system: true,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440007',
        name: 'global_admin',
        level: 'global',
        permissions: JSON.stringify(['*']),
        description: 'Global system administrator with all permissions',
        is_system: true,
      },
    ];

    console.log('📝 Seeding roles...');
    for (const role of roles) {
      try {
        await db.query(
          `INSERT INTO roles (id, name, level, permissions, description, is_system)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (name, level) DO NOTHING`,
          [role.id, role.name, role.level, role.permissions, role.description, role.is_system]
        );
      } catch (error) {
        console.warn(`⚠️ Role ${role.name} already exists`);
      }
    }

    console.log('✅ Roles seeded');

    // Create default admin user
    const adminId = '550e8400-e29b-41d4-a716-446655440000';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';

    console.log(`📝 Creating admin user (${adminEmail})...`);

    const existingAdmin = await db.queryOne<any>(
      `SELECT id FROM users WHERE email = $1`,
      [adminEmail]
    );

    if (existingAdmin) {
      console.log('⚠️ Admin user already exists');
    } else {
      const passwordHash = await authService.hashPassword(adminPassword);

      try {
        await db.query(
          `INSERT INTO users (id, email, password_hash, first_name, last_name, status, is_admin)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [adminId, adminEmail, passwordHash, 'Admin', 'User', 'active', true]
        );

        console.log('✅ Admin user created');
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);
      } catch (error) {
        console.error('❌ Failed to create admin user:', error);
      }
    }

    console.log('🎉 Auth seeding completed');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run seeding
if (require.main === module) {
  seedAuth()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { seedAuth };
