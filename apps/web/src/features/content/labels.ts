import { ContentCategory, ContentType } from '@neo/shared-types';

export const CONTENT_CATEGORY_LABEL: Record<ContentCategory, string> = {
  [ContentCategory.RECIPES]: 'Recetas',
  [ContentCategory.NUTRITION]: 'Nutrición',
  [ContentCategory.TIPS]: 'Tips',
  [ContentCategory.TECHNIQUE]: 'Técnica',
  [ContentCategory.VIDEOS]: 'Videos',
};

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  [ContentType.ARTICLE]: 'Artículo',
  [ContentType.VIDEO]: 'Video',
};
