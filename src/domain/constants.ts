import type { Topic } from './types'

export { TOPICS } from './types'

export const DEFAULT_TOPIC: Topic = '随笔'
export const DEFAULT_USER_NAME = '微波过客'

/** 动态正文字数上限（按 Unicode 字符计） */
export const CHAR_LIMIT = 140
/** 输入框允许键入的硬上限，用于让用户能看到超限提示 */
export const DRAFT_LIMIT = 200
/** 昵称长度上限 */
export const NAME_LIMIT = 12

export const STORAGE_KEYS = {
  posts: 'mwb.posts.v1',
  user: 'mwb.user.v1',
} as const

export const AVATAR_GRADIENTS = [
  'linear-gradient(140deg,#FFC28A,#FF6B2C)',
  'linear-gradient(140deg,#9BD8FF,#2B7CF6)',
  'linear-gradient(140deg,#A9E9C6,#2FA36B)',
  'linear-gradient(140deg,#FFC2CF,#E0483C)',
  'linear-gradient(140deg,#D6C6FF,#6F4CE0)',
  'linear-gradient(140deg,#FFE7A3,#F0A020)',
] as const
