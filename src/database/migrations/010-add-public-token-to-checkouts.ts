import { DataTypes, QueryInterface } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.addColumn('checkouts', 'public_token', {
    type: DataTypes.STRING(80),
    allowNull: true
  });

  await queryInterface.addColumn('checkouts', 'cancel_url', {
    type: DataTypes.TEXT,
    allowNull: true
  });

  await queryInterface.addColumn('checkouts', 'customer_name', {
    type: DataTypes.STRING(100),
    allowNull: true
  });

  await queryInterface.addColumn('checkouts', 'customer_email', {
    type: DataTypes.STRING(255),
    allowNull: true
  });

  await queryInterface.addColumn('checkouts', 'customer_phone', {
    type: DataTypes.STRING(50),
    allowNull: true
  });

  await queryInterface.addIndex('checkouts', ['public_token'], {
    unique: true,
    name: 'checkouts_public_token_unique'
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.removeIndex('checkouts', 'checkouts_public_token_unique');
  await queryInterface.removeColumn('checkouts', 'customer_phone');
  await queryInterface.removeColumn('checkouts', 'customer_email');
  await queryInterface.removeColumn('checkouts', 'customer_name');
  await queryInterface.removeColumn('checkouts', 'cancel_url');
  await queryInterface.removeColumn('checkouts', 'public_token');
}
