import { AdminUser, AdminUserRole, AdminUserStatus } from '../../models/admin-user.model.js';
import { logger } from '../../config/logger.js';

export async function seedAdminUsers(): Promise<AdminUser> {
  const adminUserData = {
    email: 'sntandu@reignovatechnologies.com',
    name: 'Shedrack Ntandu',
    role: AdminUserRole.SUPER_ADMIN,
    status: AdminUserStatus.ACTIVE,
  };

  let user = await AdminUser.findOne({ where: { email: adminUserData.email } });
  if (!user) {
    user = await AdminUser.create({
      email: adminUserData.email,
      name: adminUserData.name,
      role: adminUserData.role,
      status: adminUserData.status,
      lastActive: new Date(),
    });
    logger.info({ email: user.email, role: user.role }, 'Seeded admin user');
  }

  return user;
}
