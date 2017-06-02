-- Table: objekte

-- DROP TABLE objekte;

CREATE TABLE objekte
(
  id serial NOT NULL,
  titel character varying(255),
  bemerkung text,
  benutzer character varying(255),
  label character varying(255),
  geom geometry(Geometry,25832),
  laenge double precision,
  flaeche double precision,
  CONSTRAINT pk_objekte PRIMARY KEY (id )
)
WITH (
  OIDS=FALSE
);


-- Function: set_object_area()

-- DROP FUNCTION set_object_area();

CREATE OR REPLACE FUNCTION set_object_area()
  RETURNS trigger AS
$BODY$
    BEGIN
        IF (st_geometryType(NEW.geom) = 'ST_Polygon')
           THEN
             NEW.flaeche := ST_AREA(NEW.geom);
        END IF;
        RETURN NEW;
    END;
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;

-- Function: set_object_length()

-- DROP FUNCTION set_object_length();

CREATE OR REPLACE FUNCTION set_object_length()
  RETURNS trigger AS
$BODY$
    BEGIN
        IF (st_geometryType(NEW.geom) = 'ST_LineString') OR (st_geometryType(NEW.geom) = 'ST_MultiLineString')
           THEN
             NEW.laenge := ST_LENGTH(NEW.geom);
           END IF;
        RETURN NEW;
    END;
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;





-- Trigger: set_object_area on objekte

-- DROP TRIGGER set_object_area ON objekte;

CREATE TRIGGER set_object_area
  BEFORE INSERT OR UPDATE
  ON objekte
  FOR EACH ROW
  EXECUTE PROCEDURE set_object_area();

-- Trigger: set_object_length on objekte

-- DROP TRIGGER set_object_length ON objekte;

CREATE TRIGGER set_object_length
  BEFORE INSERT OR UPDATE
  ON objekte
  FOR EACH ROW
  EXECUTE PROCEDURE set_object_length();

