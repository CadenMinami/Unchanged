import catalogJson from "@/data/cases/varennes/course-alignment.json";
import {
  courseAlignmentCatalogSchema,
  type CourseAlignmentCatalog,
} from "@/schemas/course-alignment";

let cachedCatalog: CourseAlignmentCatalog | null = null;

export function loadVarennesAlignmentCatalog(): CourseAlignmentCatalog {
  if (!cachedCatalog) {
    cachedCatalog = courseAlignmentCatalogSchema.parse(catalogJson);
  }

  return cachedCatalog;
}
