INSERT INTO measurement_reference_ranges (type, sub_type, min_value, max_value, unit)
VALUES
  ('glucemia', NULL, 70, 140, 'mg/dL'),
  ('blood_pressure', 'systolic', 90, 120, 'mmHg'),
  ('blood_pressure', 'diastolic', 60, 80, 'mmHg')
ON CONFLICT (type, sub_type) DO NOTHING;
