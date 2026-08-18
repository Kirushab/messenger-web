import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

let chessSubscriptionGeneration = 0;

export type ChessMode = 'classic_2p' | 'cross_4p' | 'bughouse_4p';
export type ChessTeamMode = 'free_for_all' | 'teams_2v2';
export type ChessTimeControl = 'bullet_1' | 'blitz_3' | 'blitz_5' | 'rapid_10' | 'rapid_15' | 'unlimited';
export type ChessStatus = 'waiting' | 'playing' | 'finished' | 'aborted';
export type ChessResult = '1-0' | '0-1' | '1/2-1/2' | 'aborted';
export type ChessEndReason = 'checkmate' | 'stalemate' | 'resignation' | 'timeout' | 'draw_agreed' | 'threefold_repetition' | 'fifty_move_rule' | 'insufficient_material' | 'aborted';

export interface ChessGame {
  id: string;
  mode: ChessMode;
  team_mode?: ChessTeamMode;
  name: string;
  created_by: string;
  time_control: ChessTimeControl;
  white_time_ms: number | null;
  black_time_ms: number | null;
  red_time_ms?: number | null;
  blue_time_ms?: number | null;
  yellow_time_ms?: number | null;
  green_time_ms?: number | null;
  last_move_at: string | null;
  white_player_id: string | null;
  black_player_id: string | null;
  red_player_id?: string | null;
  blue_player_id?: string | null;
  yellow_player_id?: string | null;
  green_player_id?: string | null;
  status: ChessStatus;
  fen: string;
  pgn: string;
  state_4p?: any;
  current_turn: 'white' | 'black' | 'R' | 'B' | 'Y' | 'G';
  move_number: number;
  draw_offer_by: string | null;
  draw_responses_4p?: Record<string, string | null> | null;
  result: ChessResult | null;
  winner_id: string | null;
  end_reason: ChessEndReason | null;
  white_elo_before: number | null;
  black_elo_before: number | null;
  white_elo_after: number | null;
  black_elo_after: number | null;
  red_elo_before?: number | null;
  blue_elo_before?: number | null;
  yellow_elo_before?: number | null;
  green_elo_before?: number | null;
  red_elo_after?: number | null;
  blue_elo_after?: number | null;
  yellow_elo_after?: number | null;
  green_elo_after?: number | null;
  // Bughouse
  partner_game_id?: string | null;
  bughouse_match_id?: string | null;
  white_drop_pool?: string[] | null;
  black_drop_pool?: string[] | null;
  board_number?: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface ChessPlayerProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  chess_elo: number;
  chess_games_played: number;
}

interface ChessStore {
  games: Record<string, ChessGame>;
  lobbyGames: ChessGame[];
  playerProfiles: Record<string, ChessPlayerProfile>;
  currentGameId: string | null;
  currentChannel: RealtimeChannel | null;

  // Actions
  loadLobby: () => Promise<void>;
  loadGame: (id: string) => Promise<void>;
  subscribeToGame: (id: string) => Promise<void>;
  unsubscribeFromGame: () => Promise<void>;
  createGame: (name: string, mode: ChessMode, timeControl: ChessTimeControl) => Promise<{ id: string | null; error: string | null }>;
  sitDown: (gameId: string, color: 'white' | 'black') => Promise<{ error: string | null }>;
  standUp: (gameId: string) => Promise<{ error: string | null }>;
  makeMove: (gameId: string, params: {
    from: string; to: string; promotion?: string;
    san: string; fenAfter: string; pgnAfter: string;
    isCheckmate: boolean; isStalemate: boolean; isDraw: boolean;
    isThreefold: boolean; isInsufficient: boolean;
  }) => Promise<{ error: string | null }>;
  resign: (gameId: string) => Promise<{ error: string | null }>;
  offerDraw: (gameId: string) => Promise<{ error: string | null }>;
  respondDraw: (gameId: string, accept: boolean) => Promise<{ error: string | null }>;
  forceTimeout: (gameId: string) => Promise<void>;
  loadPlayerProfile: (userId: string) => Promise<void>;
  deleteGame: (gameId: string) => Promise<{ error: string | null }>;

  // 4p
  createGame4p: (name: string, timeControl: ChessTimeControl, teamMode: ChessTeamMode) => Promise<{ id: string | null; error: string | null }>;
  sitDown4p: (gameId: string, color: 'R' | 'B' | 'Y' | 'G') => Promise<{ error: string | null }>;
  standUp4p: (gameId: string) => Promise<{ error: string | null }>;
  makeMove4p: (gameId: string, params: {
    stateAfter: any;
    playerColor: 'R' | 'B' | 'Y' | 'G';
    nextTurn: 'R' | 'B' | 'Y' | 'G';
    from: string; to: string;
    isGameOver: boolean;
    scores: Record<string, number>;
    alive: Record<string, boolean>;
  }) => Promise<{ error: string | null }>;
  resign4p: (gameId: string) => Promise<{ error: string | null }>;
  offerDraw4p: (gameId: string) => Promise<{ error: string | null }>;
  respondDraw4p: (gameId: string, accept: boolean) => Promise<{ error: string | null }>;

  // History & leaderboard
  myHistory: ChessGame[];
  leaderboard: ChessPlayerProfile[];
  loadMyHistory: (myId: string) => Promise<void>;
  loadLeaderboard: () => Promise<void>;

  // Bughouse
  createBughouseMatch: (name: string, timeControl: ChessTimeControl) => Promise<{ matchId: string | null; board1Id: string | null; board2Id: string | null; error: string | null }>;
  sitDownBughouse: (matchId: string, board: 1 | 2, color: 'white' | 'black') => Promise<{ error: string | null }>;
  standUpBughouse: (matchId: string) => Promise<{ error: string | null }>;
  makeMoveBughouse: (gameId: string, params: {
    from: string; to: string; promotion?: string;
    san: string; fenAfter: string;
    captured: string | null;
    isCheckmate: boolean; isStalemate: boolean;
  }) => Promise<{ error: string | null }>;
  dropBughouse: (gameId: string, params: {
    piece: string; toSquare: string;
    san: string; fenAfter: string;
    isCheckmate: boolean; isStalemate: boolean;
  }) => Promise<{ error: string | null }>;
  resignBughouse: (gameId: string) => Promise<{ error: string | null }>;
}

export const useChessStore = create<ChessStore>((set, get) => ({
  games: {},
  lobbyGames: [],
  playerProfiles: {},
  currentGameId: null,
  currentChannel: null,
  myHistory: [],
  leaderboard: [],

  loadLobby: async () => {
    const { data, error } = await supabase
      .from('chess_games')
      .select('*')
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      set({ lobbyGames: data as ChessGame[] });
      // Подгрузить профили игроков
      const userIds = new Set<string>();
      for (const g of data) {
        if (g.white_player_id) userIds.add(g.white_player_id);
        if (g.black_player_id) userIds.add(g.black_player_id);
        if (g.red_player_id) userIds.add(g.red_player_id);
        if (g.blue_player_id) userIds.add(g.blue_player_id);
        if (g.yellow_player_id) userIds.add(g.yellow_player_id);
        if (g.green_player_id) userIds.add(g.green_player_id);
      }
      for (const uid of userIds) {
        get().loadPlayerProfile(uid);
      }
    }
  },

  deleteGame: async (gameId) => {
    const { error } = await supabase.from('chess_games').delete().eq('id', gameId);
    if (error) return { error: error.message };
    // Оптимистично выкидываем из локального списка
    set(s => ({ lobbyGames: s.lobbyGames.filter(g => g.id !== gameId) }));
    return { error: null };
  },

  loadGame: async (id) => {
    const { data, error } = await supabase
      .from('chess_games')
      .select('*')
      .eq('id', id)
      .single();
    if (!error && data) {
      const g = data as ChessGame;
      set(state => ({ games: { ...state.games, [id]: g } }));
      if (g.white_player_id) get().loadPlayerProfile(g.white_player_id);
      if (g.black_player_id) get().loadPlayerProfile(g.black_player_id);
      if (g.red_player_id) get().loadPlayerProfile(g.red_player_id);
      if (g.blue_player_id) get().loadPlayerProfile(g.blue_player_id);
      if (g.yellow_player_id) get().loadPlayerProfile(g.yellow_player_id);
      if (g.green_player_id) get().loadPlayerProfile(g.green_player_id);
    }
  },

  subscribeToGame: async (id) => {
    const existing = get();
    if (existing.currentGameId === id && existing.currentChannel) return;

    const generation = ++chessSubscriptionGeneration;
    const previous = existing.currentChannel;
    // Сбрасываем ссылку до await, чтобы параллельный вызов не попытался
    // добавить callbacks в уже подписанный канал.
    set({ currentGameId: null, currentChannel: null });
    if (previous) await supabase.removeChannel(previous);

    await get().loadGame(id);
    if (generation !== chessSubscriptionGeneration) return;

    // Уникальный topic исключает повторное использование RealtimeChannel после
    // subscribe() при быстрых mount/unmount в React StrictMode.
    const channel = supabase
      .channel(`chess_game:${id}:${generation}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chess_games', filter: `id=eq.${id}` },
        (payload) => {
          if (generation !== chessSubscriptionGeneration) return;
          const g = payload.new as ChessGame;
          set(state => ({ games: { ...state.games, [id]: g } }));
          if (g.white_player_id) get().loadPlayerProfile(g.white_player_id);
          if (g.black_player_id) get().loadPlayerProfile(g.black_player_id);
          if (g.red_player_id) get().loadPlayerProfile(g.red_player_id);
          if (g.blue_player_id) get().loadPlayerProfile(g.blue_player_id);
          if (g.yellow_player_id) get().loadPlayerProfile(g.yellow_player_id);
          if (g.green_player_id) get().loadPlayerProfile(g.green_player_id);
        }
      );

    set({ currentGameId: id, currentChannel: channel });
    channel.subscribe((status) => {
      if (generation !== chessSubscriptionGeneration) return;
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Chess realtime channel:', status, id);
      }
    });
  },

  unsubscribeFromGame: async () => {
    chessSubscriptionGeneration += 1;
    const ch = get().currentChannel;
    set({ currentGameId: null, currentChannel: null });
    if (ch) await supabase.removeChannel(ch);
  },

  createGame: async (name, mode, timeControl) => {
    const { data, error } = await supabase.rpc('chess_create_game', {
      name_param: name,
      mode_param: mode,
      time_control_param: timeControl,
    });
    if (error) return { id: null, error: error.message };
    return { id: data as string, error: null };
  },

  sitDown: async (gameId, color) => {
    const { error } = await supabase.rpc('chess_sit_down', {
      game_id_param: gameId,
      color_param: color,
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  standUp: async (gameId) => {
    const { error } = await supabase.rpc('chess_stand_up', { game_id_param: gameId });
    if (error) return { error: error.message };
    return { error: null };
  },

  makeMove: async (gameId, params) => {
    const { error } = await supabase.rpc('chess_make_move', {
      game_id_param: gameId,
      from_square_param: params.from,
      to_square_param: params.to,
      promotion_param: params.promotion ?? null,
      san_param: params.san,
      fen_after_param: params.fenAfter,
      pgn_after_param: params.pgnAfter,
      is_checkmate_param: params.isCheckmate,
      is_stalemate_param: params.isStalemate,
      is_draw_param: params.isDraw,
      is_threefold_param: params.isThreefold,
      is_insufficient_param: params.isInsufficient,
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  resign: async (gameId) => {
    const { error } = await supabase.rpc('chess_resign', { game_id_param: gameId });
    if (error) return { error: error.message };
    return { error: null };
  },

  offerDraw: async (gameId) => {
    const { error } = await supabase.rpc('chess_offer_draw', { game_id_param: gameId });
    if (error) return { error: error.message };
    return { error: null };
  },

  respondDraw: async (gameId, accept) => {
    const { error } = await supabase.rpc('chess_respond_draw', {
      game_id_param: gameId,
      accept_param: accept,
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  forceTimeout: async (gameId) => {
    await supabase.rpc('chess_force_timeout', { game_id_param: gameId });
  },

  loadPlayerProfile: async (userId) => {
    if (get().playerProfiles[userId]) return;
    const { data } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, chess_elo, chess_games_played')
      .eq('id', userId)
      .single();
    if (data) {
      set(state => ({ playerProfiles: { ...state.playerProfiles, [userId]: data as ChessPlayerProfile } }));
    }
  },

  createGame4p: async (name, timeControl, teamMode) => {
    const { data, error } = await supabase.rpc('chess_create_game', {
      name_param: name,
      mode_param: 'cross_4p',
      time_control_param: timeControl,
      team_mode_param: teamMode,
    });
    if (error) return { id: null, error: error.message };
    return { id: data as string, error: null };
  },

  sitDown4p: async (gameId, color) => {
    const { error } = await supabase.rpc('chess_4p_sit_down', {
      game_id_param: gameId,
      color_param: color,
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  standUp4p: async (gameId) => {
    const { error } = await supabase.rpc('chess_4p_stand_up', { game_id_param: gameId });
    if (error) return { error: error.message };
    return { error: null };
  },

  makeMove4p: async (gameId, params) => {
    const { error } = await supabase.rpc('chess_4p_make_move', {
      game_id_param: gameId,
      state_after_param: params.stateAfter,
      player_color_param: params.playerColor,
      next_turn_param: params.nextTurn,
      from_square_param: params.from,
      to_square_param: params.to,
      is_game_over_param: params.isGameOver,
      scores_param: params.scores,
      alive_param: params.alive,
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  resign4p: async (gameId) => {
    const { error } = await supabase.rpc('chess_4p_resign', { game_id_param: gameId });
    if (error) return { error: error.message };
    return { error: null };
  },

  offerDraw4p: async (gameId) => {
    const { error } = await supabase.rpc('chess_4p_offer_draw', { game_id_param: gameId });
    if (error) return { error: error.message };
    return { error: null };
  },

  respondDraw4p: async (gameId, accept) => {
    const { error } = await supabase.rpc('chess_4p_respond_draw', {
      game_id_param: gameId,
      accept_param: accept,
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  loadMyHistory: async (myId) => {
    // Все завершённые партии где пользователь играл
    const { data, error } = await supabase
      .from('chess_games')
      .select('*')
      .eq('status', 'finished')
      .or(`white_player_id.eq.${myId},black_player_id.eq.${myId},red_player_id.eq.${myId},blue_player_id.eq.${myId},yellow_player_id.eq.${myId},green_player_id.eq.${myId}`)
      .order('finished_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      set({ myHistory: data as ChessGame[] });
      // Подгружаем все профили участников
      const userIds = new Set<string>();
      for (const g of data) {
        if (g.white_player_id) userIds.add(g.white_player_id);
        if (g.black_player_id) userIds.add(g.black_player_id);
        if (g.red_player_id) userIds.add(g.red_player_id);
        if (g.blue_player_id) userIds.add(g.blue_player_id);
        if (g.yellow_player_id) userIds.add(g.yellow_player_id);
        if (g.green_player_id) userIds.add(g.green_player_id);
      }
      for (const uid of userIds) {
        get().loadPlayerProfile(uid);
      }
    }
  },

  loadLeaderboard: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, chess_elo, chess_games_played')
      .gt('chess_games_played', 0)
      .order('chess_elo', { ascending: false })
      .limit(10);
    if (!error && data) {
      set({ leaderboard: data as ChessPlayerProfile[] });
    }
  },

  createBughouseMatch: async (name, timeControl) => {
    const { data, error } = await supabase.rpc('chess_bughouse_create_match', {
      name_param: name,
      time_control_param: timeControl,
    });
    if (error) return { matchId: null, board1Id: null, board2Id: null, error: error.message };
    return {
      matchId: data?.match_id ?? null,
      board1Id: data?.board1_id ?? null,
      board2Id: data?.board2_id ?? null,
      error: null,
    };
  },

  sitDownBughouse: async (matchId, board, color) => {
    const { error } = await supabase.rpc('chess_bughouse_sit_down', {
      match_id_param: matchId,
      board_param: board,
      color_param: color,
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  standUpBughouse: async (matchId) => {
    const { error } = await supabase.rpc('chess_bughouse_stand_up', { match_id_param: matchId });
    if (error) return { error: error.message };
    return { error: null };
  },

  makeMoveBughouse: async (gameId, params) => {
    const { error } = await supabase.rpc('chess_bughouse_make_move', {
      game_id_param: gameId,
      from_square_param: params.from,
      to_square_param: params.to,
      promotion_param: params.promotion ?? null,
      san_param: params.san,
      fen_after_param: params.fenAfter,
      captured_param: params.captured,
      is_checkmate_param: params.isCheckmate,
      is_stalemate_param: params.isStalemate,
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  dropBughouse: async (gameId, params) => {
    const { error } = await supabase.rpc('chess_bughouse_drop', {
      game_id_param: gameId,
      piece_type_param: params.piece,
      to_square_param: params.toSquare,
      san_param: params.san,
      fen_after_param: params.fenAfter,
      is_checkmate_param: params.isCheckmate,
      is_stalemate_param: params.isStalemate,
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  resignBughouse: async (gameId) => {
    const { error } = await supabase.rpc('chess_bughouse_resign', { game_id_param: gameId });
    if (error) return { error: error.message };
    return { error: null };
  },
}));
