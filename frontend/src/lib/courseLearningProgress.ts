type CourseLearningProgress = {
  progressPercentage?: number | null;
  completedAt?: string | Date | null;
};

/** Administrative exemptions also set completedAt, so require actual learning progress. */
export function hasCompletedCourseLearning(
  course: CourseLearningProgress
): boolean {
  return course.completedAt != null && (course.progressPercentage ?? 0) >= 100;
}
