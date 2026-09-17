import { DataTypes, QueryInterface } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.createTable('audit_logs', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    actor: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    application_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'applications',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    resource_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    resource_id: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  });

  await queryInterface.addIndex('audit_logs', ['application_id'], {
    name: 'audit_logs_application_id_index'
  });
  await queryInterface.addIndex('audit_logs', ['resource_type', 'resource_id'], {
    name: 'audit_logs_resource_type_resource_id_index'
  });
  await queryInterface.addIndex('audit_logs', ['created_at'], {
    name: 'audit_logs_created_at_index'
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.dropTable('audit_logs');
}
