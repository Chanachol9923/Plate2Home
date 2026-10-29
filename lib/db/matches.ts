import 'server-only';
import type { MatchKind } from '@/lib/matching/score';
import type { Plate, PlateType } from '@/lib/plate/types';
import { toDbError } from './errors';
import { serviceClient } from './server';

export interface MatchToRecord {
  lostPostId: string;
  foundPostId: string;
  score: number;
  kind: MatchKind;
}

export interface RecordedMatch {
  matchId: string;
  lostPostId: string;
  foundPostId: string;
  kind: MatchKind;
  isNew: boolean;
}

export async function recordMatches(matches: MatchToRecord[]): Promise<RecordedMatch[]> {
  if (matches.length === 0) return [];
  const { data, error } = await serviceClient().rpc('record_matches', {
    p_matches: matches.map((m) => ({
      lost_post_id: m.lostPostId,
      found_post_id: m.foundPostId,
      score: m.score,
      kind: m.kind,
    })),
  });
  if (error) throw toDbError('record_matches', error);
  return (
    data as {
      out_match_id: string;
      out_lost_post_id: string;
      out_found_post_id: string;
      out_kind: MatchKind;
      out_is_new: boolean;
    }[]
  ).map((r) => ({
    matchId: r.out_match_id,
    lostPostId: r.out_lost_post_id,
    foundPostId: r.out_found_post_id,
    kind: r.out_kind,
    isNew: r.out_is_new,
  }));
}

export interface MatchView {
  matchId: string;
  kind: MatchKind;
  matchedAt: string;
  lostPlate: Plate;
  /** The owner's note (หมายเหตุ), shown to help the finder confirm it's the right plate. */
  lostNote: string | null;
  /** Batch ids let the page tell (from device tokens it holds) if the viewer is owner or finder. */
  lostBatchId: string;
  foundBatchId: string;
  found: {
    postId: string;
    plate: Plate;
    formatStatus: 'valid' | 'unverified';
    cropPath: string | null;
    createdAt: string;
    handover: 'with_finder' | 'police_station' | null;
  };
}

interface MatchViewRow {
  match_id: string;
  match_kind: MatchKind;
  matched_at: string;
  lost_plate_type: PlateType;
  lost_prefix_digit: string | null;
  lost_letters: string;
  lost_number: string;
  lost_province_code: string | null;
  found_post_id: string;
  found_plate_type: PlateType;
  found_prefix_digit: string | null;
  found_letters: string;
  found_number: string;
  found_province_code: string | null;
  found_format_status: 'valid' | 'unverified';
  found_crop_path: string | null;
  found_created_at: string;
  found_handover: 'with_finder' | 'police_station' | null;
  lost_note: string | null;
  lost_batch_id: string;
  found_batch_id: string;
}

/** Null when the match doesn't exist or either post is no longer active. */
export async function getMatchView(matchId: string): Promise<MatchView | null> {
  const { data, error } = await serviceClient().rpc('get_match_view', { p_match_id: matchId });
  if (error) throw toDbError('get_match_view', error);
  const r = (data as MatchViewRow[])[0];
  if (!r) return null;
  return {
    matchId: r.match_id,
    kind: r.match_kind,
    matchedAt: r.matched_at,
    lostPlate: {
      type: r.lost_plate_type,
      prefixDigit: r.lost_prefix_digit,
      letters: r.lost_letters,
      number: r.lost_number,
      provinceCode: r.lost_province_code,
    },
    lostNote: r.lost_note,
    lostBatchId: r.lost_batch_id,
    foundBatchId: r.found_batch_id,
    found: {
      postId: r.found_post_id,
      plate: {
        type: r.found_plate_type,
        prefixDigit: r.found_prefix_digit,
        letters: r.found_letters,
        number: r.found_number,
        provinceCode: r.found_province_code,
      },
      formatStatus: r.found_format_status,
      cropPath: r.found_crop_path,
      createdAt: r.found_created_at,
      handover: r.found_handover,
    },
  };
}
