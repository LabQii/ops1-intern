import { Client } from 'pg';

async function setup() {
  if (!process.env.DIRECT_URL) {
    console.error('Missing DIRECT_URL');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DIRECT_URL,
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL db...');

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ops1_documents (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_url TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    console.log('Executing DDL query...');
    await client.query(createTableQuery);

    console.log('✅ ops1_documents table is ready!');
  } catch (error) {
    console.error('❌ Error setting up DB:', error);
  } finally {
    await client.end();
  }
}

setup();
