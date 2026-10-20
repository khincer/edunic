-- Down for 0011_single_school_subjects.
--
-- The materia name comes back as free text; the catalog and its temas stay.
alter table assignments
  drop constraint if exists assignments_subject_topic_fkey;
--> statement-breakpoint
alter table grades
  drop constraint if exists grades_subject_topic_fkey;
--> statement-breakpoint
alter table grades add column if not exists subject text;
--> statement-breakpoint
update grades g
set subject = subjects.name
from subjects
where subjects.id = g.subject_id;
--> statement-breakpoint
alter table grades alter column subject set not null;
--> statement-breakpoint
alter table grades alter column subject_id drop not null;
--> statement-breakpoint
alter table topics
  drop constraint if exists topics_subject_id_id_unique;
