-- 0011_single_school_subjects
--
-- A grade and an assignment point at a materia, and optionally at one of its
-- temas. The free-text subject column goes away: the name is read from the
-- catalog.
--
-- The composite foreign key is the guarantee that a record cannot name a
-- tema of another materia: a grade that says "Matemáticas / Sumas" cannot
-- point at the tema "Revolución" of "Física".
--
-- The backfill of migration 0010 already gave every grade a materia, so the
-- column can be made mandatory.
alter table topics
  add constraint topics_subject_id_id_unique unique (subject_id, id);
--> statement-breakpoint
alter table grades
  add constraint grades_subject_topic_fkey
  foreign key (subject_id, topic_id) references topics(subject_id, id);
--> statement-breakpoint
alter table assignments
  add constraint assignments_subject_topic_fkey
  foreign key (subject_id, topic_id) references topics(subject_id, id);
--> statement-breakpoint
update grades
set subject_id = (select id from subjects where subjects.name = grades.subject)
where subject_id is null;
--> statement-breakpoint
alter table grades alter column subject_id set not null;
--> statement-breakpoint
alter table grades drop column subject;
