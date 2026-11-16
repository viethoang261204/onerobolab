-- =============================================================================
-- 0006 — Mission 1-1 "First Delivery" (mission framework)
--
-- Apply after 0004 (independent of 0005):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/0006_first_delivery.sql
-- (or paste into the Neon SQL Editor). One transaction; safe to run again.
--
-- Rebuilds starter-01 as "First Delivery": new map (lane, loading gate,
-- delivery zone the robot must STOP in), mission settings with the briefing,
-- scoring rules and stop-in-finish, four tiered hints (the full solution is
-- the paid one). Student progress, stars and XP are kept; objective ticks of
-- this level are reset because its objectives changed.
-- =============================================================================
BEGIN;

-- starter-01 · First Delivery
UPDATE levels SET title = 'First Delivery', brief_description = 'Your robot has just been switched on. Carry the supply box from Starter Base to the Supply Station and stop on the delivery pad.',
       description = 'Your robot has just been switched on. Carry the supply box from Starter Base to the Supply Station and stop on the delivery pad. Environment: Starter Courtyard — A robotics training campus with a paved practice path and a charging dock.',
       difficulty = 'BEGINNER', environment_id = 'starter-courtyard', estimated_minutes = 5,
       xp_reward = 50, par_blocks = 4, par_seconds = 16,
       allowed_blocks = ARRAY['event.start', 'motion.forward', 'motion.backward', 'motion.turnLeft', 'motion.turnRight', 'motion.stop']::text[], intro_steps = ARRAY['Drive down the lane to the loading gate', 'Turn towards the Supply Station', 'Stop on the delivery pad']::text[],
       map_definition = '{"id":"level-starter-01","name":"Starter Courtyard","schemaVersion":1,"size":{"x":6,"z":4.4},"gridSize":0.5,"floorColor":"white","start":{"x":-2.4,"z":0.9,"heading":0},"finish":{"shape":"rect","center":{"x":-0.8,"z":-0.3},"size":{"x":0.5,"z":0.5},"rotation":0},"entities":[{"id":"cp-1","type":"checkpoint","area":{"shape":"circle","center":{"x":-1.55,"z":0.9},"radius":0.22},"order":1},{"id":"hedge-a1","type":"wall","from":{"x":-2.75,"z":1.32},"to":{"x":-0.38,"z":1.32},"height":0.18,"thickness":0.14},{"id":"hedge-b1","type":"wall","from":{"x":-2.75,"z":0.48},"to":{"x":-1.22,"z":0.48},"height":0.18,"thickness":0.14},{"id":"hedge-a2","type":"wall","from":{"x":-0.38,"z":1.32},"to":{"x":-0.38,"z":-1.25},"height":0.18,"thickness":0.14},{"id":"hedge-b2","type":"wall","from":{"x":-1.22,"z":0.48},"to":{"x":-1.22,"z":-1.25},"height":0.18,"thickness":0.14},{"id":"dock-station","type":"wall","from":{"x":-1.22,"z":-1.25},"to":{"x":-0.38000000000000006,"z":-1.25},"height":0.5,"thickness":0.1}]}'::jsonb, scene_config = '{"path":[{"x":-2.75,"z":0.9},{"x":-0.8,"z":0.9},{"x":-0.8,"z":-1.2}],"pathWidth":0.72}'::jsonb, mission_settings = '{"failOnCollision":true,"timeLimit":null,"missionTitle":"First Delivery","missionDescription":"Deliver the supply box and stop inside the delivery zone.","stopInFinish":true,"scoring":{"completionPoints":500,"checkpointPoints":100,"timeBonus":{"parSeconds":16,"maxPoints":200},"efficiencyBonus":{"parBlocks":4,"maxPoints":200},"collisionPenalty":100},"briefing":{"story":"The storm knocked out Starter Island’s robot network. You have just switched on your first robot at Starter Base. The Supply Station across the courtyard needs a box of spare parts before the repairs can begin.","task":"Carry the supply box to the Supply Station and stop on the delivery pad.","objectives":{"primary":"Stop inside the delivery zone without hitting anything","secondary":"Deliver within 16 seconds","optional":"Use 4 blocks or fewer"},"concepts":["Sequence","Move forward","Turn","Stop"],"python":["robot.move_forward(cm)","robot.move_backward(cm)","robot.turn_left(degrees)","robot.turn_right(degrees)","robot.stop()"],"predict":"Before you code: how far is the corner, which way must the robot turn there, and where exactly should it stop?","pseudocode":["drive forward to the loading gate corner","turn left","drive forward onto the pad","stop"],"minutes":5,"tier":"easy","mechanics":["cargo"]}}'::jsonb
 WHERE slug = 'starter-01';
DELETE FROM student_objective_progress WHERE objective_id IN (SELECT id FROM level_objectives WHERE level_id = (SELECT id FROM levels WHERE slug = 'starter-01'));
DELETE FROM level_objectives WHERE level_id = (SELECT id FROM levels WHERE slug = 'starter-01');
DELETE FROM level_checkpoints WHERE level_id = (SELECT id FROM levels WHERE slug = 'starter-01');
INSERT INTO level_checkpoints (level_id, code, name, sort_order, position, radius) VALUES
  ((SELECT id FROM levels WHERE slug = 'starter-01'), 'cp-1', 'Pass the loading gate', 1, '{"x":-1.55,"y":0,"z":0.9}'::jsonb, 0.22);
INSERT INTO level_objectives (level_id, code, title, objective_type, checkpoint_id, config, sort_order, required) VALUES
  ((SELECT id FROM levels WHERE slug = 'starter-01'), 'cp-1', 'Pass the loading gate', 'REACH_CHECKPOINT', (SELECT id FROM level_checkpoints WHERE level_id = (SELECT id FROM levels WHERE slug = 'starter-01') AND code = 'cp-1'), '{}'::jsonb, 1, TRUE),
  ((SELECT id FROM levels WHERE slug = 'starter-01'), 'goal', 'Stop in the delivery zone', 'REACH_GOAL', NULL, '{}'::jsonb, 2, TRUE),
  ((SELECT id FROM levels WHERE slug = 'starter-01'), 'safe', 'Don’t hit any obstacles', 'AVOID_COLLISIONS', NULL, '{"maxCollisions":0}'::jsonb, 3, TRUE);
UPDATE level_hints SET title = 'Hint 1', content = 'A robot only does what you tell it — one block after another. Look at the route from above: a straight lane, one corner, then the pad.', cost = 0 WHERE level_id = (SELECT id FROM levels WHERE slug = 'starter-01') AND sort_order = 1;
INSERT INTO level_hints (level_id, title, content, cost, sort_order) SELECT (SELECT id FROM levels WHERE slug = 'starter-01'), 'Hint 1', 'A robot only does what you tell it — one block after another. Look at the route from above: a straight lane, one corner, then the pad.', 0, 1 WHERE NOT EXISTS (SELECT 1 FROM level_hints WHERE level_id = (SELECT id FROM levels WHERE slug = 'starter-01') AND sort_order = 1);
UPDATE level_hints SET title = 'Hint 2', content = 'In order: drive to the corner → turn left → drive to the pad → stop.', cost = 0 WHERE level_id = (SELECT id FROM levels WHERE slug = 'starter-01') AND sort_order = 2;
INSERT INTO level_hints (level_id, title, content, cost, sort_order) SELECT (SELECT id FROM levels WHERE slug = 'starter-01'), 'Hint 2', 'In order: drive to the corner → turn left → drive to the pad → stop.', 0, 2 WHERE NOT EXISTS (SELECT 1 FROM level_hints WHERE level_id = (SELECT id FROM levels WHERE slug = 'starter-01') AND sort_order = 2);
UPDATE level_hints SET title = 'Hint 3', content = 'move forward 160 cm → turn left 90° → move forward ? cm → stop. Each paving slab is 40 cm long: count the slabs to the pad.', cost = 0 WHERE level_id = (SELECT id FROM levels WHERE slug = 'starter-01') AND sort_order = 3;
INSERT INTO level_hints (level_id, title, content, cost, sort_order) SELECT (SELECT id FROM levels WHERE slug = 'starter-01'), 'Hint 3', 'move forward 160 cm → turn left 90° → move forward ? cm → stop. Each paving slab is 40 cm long: count the slabs to the pad.', 0, 3 WHERE NOT EXISTS (SELECT 1 FROM level_hints WHERE level_id = (SELECT id FROM levels WHERE slug = 'starter-01') AND sort_order = 3);
UPDATE level_hints SET title = 'Hint 4', content = 'move forward 160 cm → turn left 90° → move forward 120 cm → stop.', cost = 10 WHERE level_id = (SELECT id FROM levels WHERE slug = 'starter-01') AND sort_order = 4;
INSERT INTO level_hints (level_id, title, content, cost, sort_order) SELECT (SELECT id FROM levels WHERE slug = 'starter-01'), 'Hint 4', 'move forward 160 cm → turn left 90° → move forward 120 cm → stop.', 10, 4 WHERE NOT EXISTS (SELECT 1 FROM level_hints WHERE level_id = (SELECT id FROM levels WHERE slug = 'starter-01') AND sort_order = 4);

COMMIT;