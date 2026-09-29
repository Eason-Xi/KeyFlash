export const chips = ['ESP32', 'ESP32-S3', 'ESP32-C3'] as const;
export const deviceTypes = [
  '宏键盘',
  '普通键盘',
  '旋钮键盘',
  'MIDI 控制器',
  'Stream Deck',
  '游戏控制器',
  '自定义 HID',
  '其他',
];
export const features = [
  'USB HID',
  'BLE 蓝牙',
  'Wi-Fi',
  'RGB',
  'OLED',
  'LCD',
  'Encoder',
  'VIA',
  'Vial',
  'Macro',
  'Media Control',
];
export const projectColors = ['orange', 'purple', 'blue', 'green', 'pink', 'yellow'] as const;
export type Chip = (typeof chips)[number];
export type Project = {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  chip: Chip;
  device_type: string;
  features: string[];
  hardware: string;
  license: string;
  github_url: string;
  website_url: string;
  status: 'stable' | 'beta' | 'experimental' | 'archived';
  created_at: string;
  updated_at: string;
  author: string;
  color: string;
  rating: number;
  flash_count: number;
  success_count: number;
  failure_count: number;
  favorite_count: number;
  version: string;
  demo?: boolean;
};
export type FirmwareFile = {
  path: string;
  name: string;
  address: number;
  size: number;
  sha256: string;
};
export type Manifest = { chip: Chip; baudRate: number; files: FirmwareFile[] };
export type Release = {
  id: string;
  project_id: string;
  version: string;
  channel: 'stable' | 'beta' | 'experimental';
  changelog: string;
  hardware: string;
  manifest: Manifest;
  online_enabled: boolean;
  created_at: string;
};
export type Comment = {
  id: string;
  project_id: string;
  user_id: string;
  author: string;
  body: string;
  rating: number | null;
  device: string;
  created_at: string;
};
export type Compatibility = {
  id: string;
  project_id: string;
  user_id: string;
  version_id: string;
  chip: Chip;
  hardware: string;
  os: string;
  browser: string;
  usb_chip: string;
  bluetooth: string;
  rgb: string;
  encoder: string;
  success: boolean;
  notes: string;
  created_at: string;
};
export type FlashSession = {
  id: string;
  user_id: string;
  project_id: string;
  version_id: string;
  chip: string;
  status: 'started' | 'success' | 'failed';
  firmware_versions?: { version: string } | null;
  projects?: { name: string; slug: string } | null;
  error: string;
  created_at: string;
};
