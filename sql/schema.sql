-- Dream Neighborhood — Schools tab demo
-- Postgres + PostGIS schema (Supabase-compatible).
--
-- Run this in the Supabase SQL editor (or any Postgres with PostGIS) to create
-- the tables described in the brief. The local Next.js demo does NOT require
-- this; it reads the JSON bundle in /data and replicates the PostGIS queries
-- (point-in-polygon, radius search) in TypeScript. Use this schema when you are
-- ready to host the data in Supabase.

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- school_districts
-- ---------------------------------------------------------------------------
create table if not exists school_districts (
    district_id   text primary key,           -- NCES LEA id
    name          text not null,
    short_name    text,
    state         text,
    geom          geometry(MultiPolygon, 4326) -- district boundary
);
create index if not exists school_districts_geom_idx
    on school_districts using gist (geom);

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
create table if not exists schools (
    nces_id                 text primary key,  -- NCES school id
    name                    text not null,
    type                    text,              -- Elementary / Middle / High / Combined / Charter
    grade_low               text,
    grade_high              text,
    zip                     text,
    district_id             text references school_districts(district_id),
    enrollment              integer,
    student_teacher_ratio   numeric,
    geom                    geometry(Point, 4326)  -- school location (lon/lat)
);
create index if not exists schools_geom_idx on schools using gist (geom);
create index if not exists schools_zip_idx on schools (zip);
create index if not exists schools_district_idx on schools (district_id);

-- ---------------------------------------------------------------------------
-- school_safety  (SSOCS 2021-22 style; join on nces_id)
-- ---------------------------------------------------------------------------
create table if not exists school_safety (
    nces_id                     text primary key references schools(nces_id),
    school_year                 text,          -- e.g. '2021-22'
    source                      text,
    aggravated_assaults         integer,
    violent_incidents_total     integer,
    threats_of_violence         integer,
    theft_larceny               integer,
    vandalism                   integer,
    drug_incidents              integer,
    weapons_possession          integer,
    police_calls                integer,
    security_cameras            boolean,
    controlled_building_access  boolean,
    sworn_law_enforcement       boolean,
    visitor_sign_in             boolean
);

-- ---------------------------------------------------------------------------
-- school_graduation  (join on nces_id)
-- ---------------------------------------------------------------------------
create table if not exists school_graduation (
    nces_id            text primary key references schools(nces_id),
    school_year        text,
    source             text,
    grad_rate_4yr      numeric,
    college_going_rate numeric
);

-- ---------------------------------------------------------------------------
-- Example PostGIS queries used by the demo
-- ---------------------------------------------------------------------------
-- 1) Which district contains an address? (point-in-polygon)
--    select d.* from school_districts d
--    where st_contains(d.geom, st_setsrid(st_point(:lon, :lat), 4326));
--
-- 2) Nearby schools within ~10 miles, nearest first (radius search)
--    select s.*, st_distance(s.geom::geography,
--                            st_setsrid(st_point(:lon, :lat), 4326)::geography)
--               / 1609.34 as miles
--    from schools s
--    where st_dwithin(s.geom::geography,
--                     st_setsrid(st_point(:lon, :lat), 4326)::geography,
--                     16093.4)
--    order by miles asc
--    limit 8;
