-- Migration: measurement_reference_ranges, measurements, alerts tables
-- Seed: glucose reference range 70-100 mg/dL

CREATE TABLE IF NOT EXISTS measurement_reference_ranges (
  id SERIAL PRIMARY KEY,
  measurement_type VARCHAR(50) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  range_min NUMERIC(10, 2) NOT NULL,
  range_max NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS measurements (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measurement_type VARCHAR(50) NOT NULL,
  value NUMERIC(10, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  notes TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  measurement_id INTEGER NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_measurements_patient_id ON measurements(patient_id);
CREATE INDEX idx_measurements_recorded_at ON measurements(recorded_at);
CREATE INDEX idx_alerts_patient_id ON alerts(patient_id);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged);

-- Seed glucose reference range
INSERT INTO measurement_reference_ranges (measurement_type, unit, range_min, range_max)
VALUES ('glucose', 'mg/dL', 70, 100);
