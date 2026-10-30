/**
 * Player statistics and record tracking for Chess the Gathering.
 * Pure functions with no browser dependencies, plus a thin localStorage adapter.
 */

                                                 
                                        
                                          

                            
                     
                 
                 
                 
                       
 

                              
                
               
                
                 
                        
                     
            
                 
                   
    
           
                    
                 
    
                     
                           
 

                               
                
               
                
                 
                        
                     
            
                 
                   
    
           
                    
                 
    
               
 

export const STATS_KEY = "ctg_stats";

export function createDefaultStats()              {
  return {
    games: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    currentStreak: 0,
    bestStreak: 0,
    byLevel: {
      easy: 0,
      normal: 0,
    },
    byDeck: {
      starter: 0,
      full: 0,
    },
    totalPlies: 0,
    totalCardsPlayed: 0,
  };
}

export function recordResult(
  stats                                ,
  entry           
)              {
  const s              = stats
    ? {
        games: Number(stats.games) || 0,
        wins: Number(stats.wins) || 0,
        draws: Number(stats.draws) || 0,
        losses: Number(stats.losses) || 0,
        currentStreak: Number(stats.currentStreak) || 0,
        bestStreak: Number(stats.bestStreak) || 0,
        byLevel: {
          easy: Number(stats.byLevel?.easy) || 0,
          normal: Number(stats.byLevel?.normal) || 0,
        },
        byDeck: {
          starter: Number(stats.byDeck?.starter) || 0,
          full: Number(stats.byDeck?.full) || 0,
        },
        totalPlies: Number(stats.totalPlies) || 0,
        totalCardsPlayed: Number(stats.totalCardsPlayed) || 0,
      }
    : createDefaultStats();

  s.games += 1;
  const plies = Number(entry.plies) || 0;
  const cards = Number(entry.cardsPlayed) || 0;
  s.totalPlies += plies;
  s.totalCardsPlayed += cards;

  const res = entry.result;
  const lvl          = entry.level === "easy" ? "easy" : "normal";
  const dck           = entry.deck === "starter" ? "starter" : "full";

  if (res === "win") {
    s.wins += 1;
    s.currentStreak += 1;
    if (s.currentStreak > s.bestStreak) {
      s.bestStreak = s.currentStreak;
    }
    s.byLevel[lvl] += 1;
    s.byDeck[dck] += 1;
  } else if (res === "loss") {
    s.losses += 1;
    s.currentStreak = 0;
  } else if (res === "draw") {
    s.draws += 1;
    // Empate não quebra a sequência de vitórias, mas não a aumenta
  }

  return s;
}

export function formatRecord(stats             )         {
  const w = stats.wins || 0;
  const d = stats.draws || 0;
  const l = stats.losses || 0;
  const streak = stats.currentStreak || 0;
  return `Record: ${w} wins, ${d} draws, ${l} losses (streak ${streak})`;
}

export function summary(stats                                )               {
  const s = stats && typeof stats === "object" ? stats : createDefaultStats();
  const wins = Number(s.wins) || 0;
  const draws = Number(s.draws) || 0;
  const losses = Number(s.losses) || 0;
  const currentStreak = Number(s.currentStreak) || 0;
  const bestStreak = Number(s.bestStreak) || 0;
  const games = Number(s.games) || wins + draws + losses;
  const byLevel = {
    easy: Number(s.byLevel?.easy) || 0,
    normal: Number(s.byLevel?.normal) || 0,
  };
  const byDeck = {
    starter: Number(s.byDeck?.starter) || 0,
    full: Number(s.byDeck?.full) || 0,
  };

  return {
    games,
    wins,
    draws,
    losses,
    currentStreak,
    bestStreak,
    byLevel,
    byDeck,
    text: `Record: ${wins} wins, ${draws} draws, ${losses} losses (streak ${currentStreak})`,
  };
}

export function loadStats(storage      )              {
  try {
    const store =
      storage !== undefined
        ? storage
        : typeof localStorage !== "undefined"
        ? localStorage
        : null;
    if (!store) {
      return createDefaultStats();
    }
    const raw = store.getItem(STATS_KEY);
    if (!raw) {
      return createDefaultStats();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return createDefaultStats();
    }
    return {
      games: Number(parsed.games) || 0,
      wins: Number(parsed.wins) || 0,
      draws: Number(parsed.draws) || 0,
      losses: Number(parsed.losses) || 0,
      currentStreak: Number(parsed.currentStreak) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
      byLevel: {
        easy: Number(parsed.byLevel?.easy) || 0,
        normal: Number(parsed.byLevel?.normal) || 0,
      },
      byDeck: {
        starter: Number(parsed.byDeck?.starter) || 0,
        full: Number(parsed.byDeck?.full) || 0,
      },
      totalPlies: Number(parsed.totalPlies) || 0,
      totalCardsPlayed: Number(parsed.totalCardsPlayed) || 0,
    };
  } catch {
    return createDefaultStats();
  }
}

export function saveStats(stats             , storage      )          {
  try {
    const store =
      storage !== undefined
        ? storage
        : typeof localStorage !== "undefined"
        ? localStorage
        : null;
    if (!store) {
      return false;
    }
    store.setItem(STATS_KEY, JSON.stringify(stats));
    return true;
  } catch {
    return false;
  }
}
