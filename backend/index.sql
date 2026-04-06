CREATE TYPE user_role AS ENUM('Admin', 'Production Manager', 'Inventory Staff', 'Quality Checker', 'Worker');
CREATE TYPE suffix AS ENUM('None', 'Sr.', 'Jr.', 'II', 'III', 'IV', 'V');

CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(255),
    user_password VARCHAR(255),
    first_name VARCHAR(255),
    middle_name VARCHAR(255),
    last_name VARCHAR(255),
    suffix suffix,
    user_role user_role,
    created_at DATE DEFAULT now();
);
