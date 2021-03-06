/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'varchar(255)', notNull: true, unique: true },
    first_name: { type: 'varchar(255)', notNull: true },
    last_name: { type: 'varchar(255)' },
    confirmed: { type: 'boolean', notNull: true, default: false },
    admin: { type: 'boolean', notNull: true, default: false },
    hash: { type: 'varchar(255)' },
    metadata: { type: 'json' },

    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addIndex('users', ['id', 'email']);
};

exports.down = pgm => {
  pgm.dropTable('users');
};
