export type CourseQuizLevel = {
  level: number;
  titleAr: string;
  titleEn: string;
  startOrder: number;
  endOrder: number;
};

export const COURSE_QUIZ_LEVELS: CourseQuizLevel[] = [
  { level: 1, titleAr: "المستوى الأول", titleEn: "Level 1", startOrder: 1, endOrder: 14 },
  { level: 2, titleAr: "المستوى الثاني", titleEn: "Level 2", startOrder: 15, endOrder: 17 },
  { level: 3, titleAr: "المستوى الثالث", titleEn: "Level 3", startOrder: 18, endOrder: 20 },
  { level: 4, titleAr: "المستوى الرابع", titleEn: "Level 4", startOrder: 21, endOrder: 25 },
  { level: 5, titleAr: "المستوى الخامس", titleEn: "Level 5", startOrder: 26, endOrder: 36 },
  { level: 6, titleAr: "المستوى السادس", titleEn: "Level 6", startOrder: 37, endOrder: 37 },
  { level: 7, titleAr: "المستوى السابع", titleEn: "Level 7", startOrder: 38, endOrder: 38 },
  { level: 8, titleAr: "المستوى الثامن", titleEn: "Level 8", startOrder: 39, endOrder: 39 },
];

export function getCourseQuizLevelForEpisodeOrder(order: number) {
  return COURSE_QUIZ_LEVELS.find((level) => order >= level.startOrder && order <= level.endOrder) ?? null;
}

export function isCourseQuizLevelEnd(order: number) {
  const level = getCourseQuizLevelForEpisodeOrder(order);
  return !!level && level.endOrder === order;
}
