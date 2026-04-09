ALTER TABLE testimonials ADD COLUMN proof_image_url TEXT;
ALTER TABLE testimonials ADD COLUMN show_proof_on_home INTEGER NOT NULL DEFAULT 0;
ALTER TABLE testimonials ADD COLUMN show_proof_on_dashboard INTEGER NOT NULL DEFAULT 0;
