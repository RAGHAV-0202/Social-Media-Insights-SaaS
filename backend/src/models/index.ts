import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  name: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});

export const UserModel = mongoose.model('User', userSchema);

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  apify_api_key: { type: String, default: null },
  update_frequency: { type: String, default: 'manual' },
  apify_data_limit: { type: Number, default: 100 },
  created_at: { type: Date, default: Date.now },
});

export const WorkspaceModel = mongoose.model('Workspace', workspaceSchema);

const profileSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  platform: { type: String, required: true },
  handle: { type: String, required: true },
  profile_url: { type: String, required: true },
  external_id: { type: String },
  display_name: { type: String },
  avatar_url: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export const ProfileModel = mongoose.model('Profile', profileSchema);

const profileSnapshotSchema = new mongoose.Schema({
  profile_id: { type: String, required: true },
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  followers: { type: Number },
  following: { type: Number },
  total_posts: { type: Number },
  total_views: { type: Number },
  raw: { type: mongoose.Schema.Types.Mixed },
  captured_at: { type: Date, default: Date.now },
});

export const ProfileSnapshotModel = mongoose.model('ProfileSnapshot', profileSnapshotSchema);

const postSchema = new mongoose.Schema({
  id: { type: String, default: () => new mongoose.Types.ObjectId().toString(), unique: true },
  profile_id: { type: String, required: true },
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  external_id: { type: String, required: true },
  posted_at: { type: Date },
  url: { type: String },
  thumbnail_url: { type: String },
  caption: { type: String },
  media_type: { type: String },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  engagement_rate: { type: Number, default: 0 },
  raw: { type: mongoose.Schema.Types.Mixed },
  fetched_at: { type: Date, default: Date.now },
});

postSchema.index({ profile_id: 1, external_id: 1 }, { unique: true });

export const PostModel = mongoose.model('Post', postSchema);

const refreshRunSchema = new mongoose.Schema({
  id: { type: String, default: () => new mongoose.Types.ObjectId().toString(), unique: true },
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  started_at: { type: Date, default: Date.now },
  finished_at: { type: Date },
  status: { type: String, default: 'running' },
  triggered_by: { type: String },
  profiles_updated: { type: Number, default: 0 },
  posts_upserted: { type: Number, default: 0 },
  errors: { type: mongoose.Schema.Types.Mixed },
  progress: { type: mongoose.Schema.Types.Mixed, default: {} },
});

export const RefreshRunModel = mongoose.model('RefreshRun', refreshRunSchema);
