const PETS = [
  {
    slug: 'tom',
    display_name: 'TOM',
    satiety: 78,
    cleanliness: 82,
    energy: 74,
    affection: 60,
  },
  {
    slug: 'pipi',
    display_name: '皮皮',
    satiety: 74,
    cleanliness: 78,
    energy: 82,
    affection: 64,
  },
];

function nowIso(clock) {
  return new Date(clock()).toISOString();
}

export function createPetStore(database, { clock = Date.now } = {}) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS pets (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      slug              TEXT NOT NULL UNIQUE,
      display_name      TEXT NOT NULL,
      adoption_date     TEXT NOT NULL,
      satiety           REAL NOT NULL DEFAULT 80,
      cleanliness       REAL NOT NULL DEFAULT 80,
      energy            REAL NOT NULL DEFAULT 80,
      affection         REAL NOT NULL DEFAULT 50,
      care_points       INTEGER NOT NULL DEFAULT 0,
      sleeping_since    TEXT,
      last_simulated_at TEXT NOT NULL,
      current_pose      TEXT NOT NULL DEFAULT 'idle'
    );

    CREATE TABLE IF NOT EXISTS pet_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_slug   TEXT NOT NULL,
      action     TEXT NOT NULL,
      summary    TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS pet_events_slug_time
      ON pet_events (pet_slug, created_at DESC);
  `);

  const seed = database.prepare(`
    INSERT INTO pets (
      slug, display_name, adoption_date, satiety, cleanliness, energy,
      affection, care_points, sleeping_since, last_simulated_at, current_pose
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, 'idle')
    ON CONFLICT(slug) DO NOTHING
  `);
  const adoptionDate = new Date(clock()).toISOString().slice(0, 10);
  const seededAt = nowIso(clock);
  for (const pet of PETS) {
    seed.run(
      pet.slug,
      pet.display_name,
      adoptionDate,
      pet.satiety,
      pet.cleanliness,
      pet.energy,
      pet.affection,
      seededAt
    );
  }

  function listPets() {
    return database
      .prepare(
        "SELECT * FROM pets ORDER BY CASE slug WHEN 'tom' THEN 0 WHEN 'pipi' THEN 1 ELSE 2 END"
      )
      .all();
  }

  function getPet(slug) {
    return database.prepare('SELECT * FROM pets WHERE slug = ?').get(slug) || null;
  }

  function savePet(pet) {
    database
      .prepare(
        `UPDATE pets SET
          display_name = ?, adoption_date = ?, satiety = ?, cleanliness = ?,
          energy = ?, affection = ?, care_points = ?, sleeping_since = ?,
          last_simulated_at = ?, current_pose = ?
         WHERE slug = ?`
      )
      .run(
        pet.display_name,
        pet.adoption_date,
        pet.satiety,
        pet.cleanliness,
        pet.energy,
        pet.affection,
        pet.care_points,
        pet.sleeping_since || null,
        pet.last_simulated_at,
        pet.current_pose || 'idle',
        pet.slug
      );
    return getPet(pet.slug);
  }

  function recordEvent(slug, action, summary, createdAt = nowIso(clock)) {
    const info = database
      .prepare(
        'INSERT INTO pet_events (pet_slug, action, summary, created_at) VALUES (?, ?, ?, ?)'
      )
      .run(slug, action, summary, createdAt);
    return database
      .prepare('SELECT * FROM pet_events WHERE id = ?')
      .get(Number(info.lastInsertRowid));
  }

  function listEvents(limit = 30) {
    return database
      .prepare(
        'SELECT * FROM pet_events ORDER BY created_at DESC, id DESC LIMIT ?'
      )
      .all(Math.max(1, Math.min(100, Number(limit) || 30)));
  }

  function lastActionAt(slug) {
    const row = database
      .prepare(
        'SELECT created_at FROM pet_events WHERE pet_slug = ? ORDER BY created_at DESC, id DESC LIMIT 1'
      )
      .get(slug);
    return row ? row.created_at : null;
  }

  return {
    listPets,
    getPet,
    savePet,
    recordEvent,
    listEvents,
    lastActionAt,
  };
}
