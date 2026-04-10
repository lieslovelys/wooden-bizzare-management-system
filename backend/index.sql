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




-- Inventory
CREATE TABLE inventory_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    total_stock INT NOT NULL,
    unit VARCHAR(50) NOT NULL, 
    status VARCHAR(50) NOT NULL 
);

CREATE TABLE item_variants (
    id SERIAL PRIMARY KEY,
    item_id INT REFERENCES inventory_items(id) ON DELETE CASCADE,
    variant_name VARCHAR(100) NOT NULL,
    current_stock INT NOT NULL,
    min_stock INT NOT NULL
);

-- CreateProjectForm

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    contact_number VARCHAR(50),
    date_ordered DATE,
    client_payment DECIMAL(12, 2),
    priority_level VARCHAR(50),
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_variables (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    variable_name VARCHAR(255) NOT NULL,
    variable_detail TEXT
);


-- Worker List

CREATE TABLE worker_details (
    detail_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE, -- Ito ang tulay natin
    job_type VARCHAR(50),  -- Halimbawa: 'Regular', 'Part-Time'
    job_role VARCHAR(100), -- Halimbawa: 'Carpenter', 'Carver', 'Liha'
    contact VARCHAR(50),
    rate NUMERIC(10, 2)    -- Pera format (e.g., 800.00)
);