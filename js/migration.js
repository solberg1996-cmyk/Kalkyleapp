// ── Strukturert database-migrasjon ───────────────────────────────────────
// SQL-strenger for å opprette normaliserte tabeller i Supabase.
// Kjør disse manuelt i Supabase SQL Editor.

export const MIGRATION_SQL = `
-- Kunder-tabell
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prosjekter-tabell
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  customer_id TEXT,
  name TEXT,
  address TEXT,
  type TEXT DEFAULT 'Annet',
  status TEXT DEFAULT 'Utkast',
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Brukerinnstillinger
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  settings JSONB,
  company JSONB,
  calc_rates JSONB,
  user_templates JSONB,
  price_catalog JSONB,
  price_file_name TEXT,
  favorite_catalog_ids JSONB,
  recent_catalog_ids JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS-policyer
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own customers" ON customers
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);

-- RLS for eksisterende user_data-tabell (hvis ikke allerede satt)
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can manage own data" ON user_data
  FOR ALL USING (auth.uid() = user_id);
`;

export async function checkMigrationStatus(sb, userId) {
  try {
    const { error } = await sb.from('customers').select('id').limit(1);
    if (error && error.code === '42P01') return 'legacy'; // Tabell finnes ikke
    return 'v2';
  } catch {
    return 'legacy';
  }
}

export async function migrateToStructured(sb, userId, state) {
  // Les fra gammel JSON-blob og skriv til nye tabeller
  try {
    // Kunder
    if (state.customers?.length) {
      const rows = state.customers.map(c => ({
        id: c.id, user_id: userId, name: c.name, phone: c.phone,
        email: c.email, address: c.address
      }));
      await sb.from('customers').upsert(rows, { onConflict: 'id' });
    }

    // Prosjekter
    if (state.projects?.length) {
      const rows = state.projects.map(p => ({
        id: p.id, user_id: userId, customer_id: p.customerId,
        name: p.name, address: p.address, type: p.type, status: p.status,
        data: p
      }));
      await sb.from('projects').upsert(rows, { onConflict: 'id' });
    }

    // Innstillinger
    await sb.from('user_settings').upsert({
      user_id: userId,
      settings: state.settings,
      company: state.company,
      calc_rates: state.calcRates,
      user_templates: state.userTemplates,
      price_catalog: state.priceCatalog,
      price_file_name: state.priceFileName,
      favorite_catalog_ids: state.favoriteCatalogIds,
      recent_catalog_ids: state.recentCatalogIds,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    return true;
  } catch (e) {
    console.error('Migration feilet:', e);
    return false;
  }
}

export async function saveStructured(sb, userId, state) {
  try {
    // Kunder
    if (state.customers?.length) {
      const rows = state.customers.map(c => ({
        id: c.id, user_id: userId, name: c.name, phone: c.phone,
        email: c.email, address: c.address, updated_at: new Date().toISOString()
      }));
      await sb.from('customers').upsert(rows, { onConflict: 'id' });
    }

    // Prosjekter
    if (state.projects?.length) {
      const rows = state.projects.map(p => ({
        id: p.id, user_id: userId, customer_id: p.customerId,
        name: p.name, address: p.address, type: p.type, status: p.status,
        data: p, updated_at: new Date().toISOString()
      }));
      await sb.from('projects').upsert(rows, { onConflict: 'id' });
    }

    // Innstillinger
    await sb.from('user_settings').upsert({
      user_id: userId,
      settings: state.settings,
      company: state.company,
      calc_rates: state.calcRates,
      user_templates: state.userTemplates,
      price_catalog: state.priceCatalog,
      price_file_name: state.priceFileName,
      favorite_catalog_ids: state.favoriteCatalogIds,
      recent_catalog_ids: state.recentCatalogIds,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    return true;
  } catch (e) {
    console.error('Structured save feilet:', e);
    return false;
  }
}

export async function loadStructured(sb, userId) {
  try {
    const [custRes, projRes, settRes] = await Promise.all([
      sb.from('customers').select('*').eq('user_id', userId),
      sb.from('projects').select('*').eq('user_id', userId),
      sb.from('user_settings').select('*').eq('user_id', userId).single()
    ]);

    const result = {};
    if (custRes.data) {
      result.customers = custRes.data.map(c => ({
        id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address
      }));
    }
    if (projRes.data) {
      result.projects = projRes.data.map(p => p.data || p);
    }
    if (settRes.data) {
      const s = settRes.data;
      result.settings = s.settings;
      result.company = s.company;
      result.calcRates = s.calc_rates;
      result.userTemplates = s.user_templates;
      result.priceCatalog = s.price_catalog;
      result.priceFileName = s.price_file_name;
      result.favoriteCatalogIds = s.favorite_catalog_ids;
      result.recentCatalogIds = s.recent_catalog_ids;
    }
    return result;
  } catch (e) {
    console.error('Structured load feilet:', e);
    return null;
  }
}
