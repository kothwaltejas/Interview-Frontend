import React from 'react';

interface SectorScore {
  score: number | null;
  weight: number;
  available: boolean;
  metrics?: Record<string, any>;
}

interface CompositeData {
  composite_score: number;
  sector_scores: {
    text: SectorScore;
    voice: SectorScore;
    camera: SectorScore;
  };
}

interface EvaluationBreakdownProps {
  score: number;
  reasoning: string;
  strengths: string[];
  gaps: string[];
  llm_used: boolean;
  dataset_match_type: "strong_match" | "weak_match" | "no_match";
  difficulty: "easy" | "medium" | "hard";
  composite?: CompositeData;
}

function scoreColor(s: number): string {
  if (s >= 8) return '#10b981';
  if (s >= 5) return '#f59e0b';
  return '#ef4444';
}

function scoreBorder(s: number): string {
  if (s >= 8) return 'border-green-500';
  if (s >= 5) return 'border-amber-500';
  return 'border-red-500';
}

function scoreTextClass(s: number): string {
  if (s >= 8) return 'text-green-500';
  if (s >= 5) return 'text-amber-500';
  return 'text-red-500';
}

const SectorBar: React.FC<{ label: string; icon: string; score: number | null; available: boolean; detail?: string }> = ({
  label, icon, score, available, detail,
}) => {
  if (!available || score === null) {
    return (
      <div className="flex items-center gap-3 opacity-40">
        <span className="text-base w-5 text-center">{icon}</span>
        <span className="text-xs text-slate-400 flex-1">{label}</span>
        <span className="text-xs text-slate-500 italic">N/A</span>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, (score / 10) * 100));

  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 text-center">{icon}</span>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-300 font-medium">{label}</span>
          <span className="text-xs font-bold" style={{ color: scoreColor(score) }}>{score.toFixed(1)}</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: scoreColor(score) }}
          />
        </div>
        {detail && <span className="text-[10px] text-slate-500">{detail}</span>}
      </div>
    </div>
  );
};

const EvaluationBreakdown: React.FC<EvaluationBreakdownProps> = ({
  score,
  reasoning,
  strengths,
  gaps,
  llm_used,
  dataset_match_type,
  difficulty,
  composite,
}) => {
  const displayScore = composite?.composite_score ?? score;
  const colorClass = scoreTextClass(displayScore);
  const borderClass = scoreBorder(displayScore);
  const formattedDifficulty = difficulty ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) : '';

  const voiceMetrics = composite?.sector_scores?.voice?.metrics;
  const cameraMetrics = composite?.sector_scores?.camera?.metrics;

  const voiceDetail = voiceMetrics
    ? `${voiceMetrics.words_per_minute?.toFixed(0) || '?'} WPM, ${voiceMetrics.filler_word_count || 0} fillers`
    : undefined;

  const cameraDetail = cameraMetrics
    ? `${Math.round((cameraMetrics.attentionScore || 0) * 100)}% attention`
    : undefined;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-xl max-w-2xl w-full text-slate-100 flex flex-col gap-5">
      <div className="flex items-center gap-6">
        <div className={`relative flex items-center justify-center w-20 h-20 rounded-full border-4 ${borderClass} shadow-md flex-shrink-0`}>
          <div className="flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${colorClass}`}>{displayScore.toFixed(1)}</span>
            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">/ 10</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-slate-300">
            Difficulty: <span className="font-semibold text-slate-100">{formattedDifficulty || 'Medium'}</span>
          </div>
          {composite && (
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Composite Score (Text + Voice + Camera)
            </span>
          )}
          <div className="flex flex-wrap gap-2">
            {llm_used === false && (
              <div
                className="relative group cursor-help inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700"
                title="AI evaluation was unavailable. Score based on keyword match and answer length."
              >
                <span>Rule-based score</span>
                <span className="text-slate-400">i</span>
              </div>
            )}
            {dataset_match_type === "no_match" && (
              <div
                className="relative group cursor-help inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700"
                title="This question was not in our training dataset. Evaluated using general criteria."
              >
                <span>General rubric</span>
                <span className="text-slate-400">i</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {composite && (
        <div className="flex flex-col gap-3 bg-slate-800/30 rounded-lg p-4 border border-slate-800/50">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Sector Breakdown</span>
          <SectorBar
            label="Text Answer"
            icon="T"
            score={composite.sector_scores.text.score}
            available={composite.sector_scores.text.available}
          />
          <SectorBar
            label="Voice & Fluency"
            icon="V"
            score={composite.sector_scores.voice.score}
            available={composite.sector_scores.voice.available}
            detail={voiceDetail}
          />
          <SectorBar
            label="Camera & Attention"
            icon="C"
            score={composite.sector_scores.camera.score}
            available={composite.sector_scores.camera.available}
            detail={cameraDetail}
          />
        </div>
      )}

      {reasoning && (
        <div className="text-slate-300 text-sm leading-relaxed italic bg-slate-800/40 p-4 rounded-lg border border-slate-800/60">
          "{reasoning}"
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-green-400 flex items-center gap-1.5">
          <span className="text-lg">+</span> Strengths
        </h4>
        {strengths && strengths.length > 0 ? (
          <ul className="list-none flex flex-col gap-1.5 pl-2 text-slate-300 text-sm">
            {strengths.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-green-500 font-semibold mt-0.5">*</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-sm italic pl-2">No specific strengths identified</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
          <span className="text-lg">!</span> Areas to improve
        </h4>
        {gaps && gaps.length > 0 ? (
          <ul className="list-none flex flex-col gap-1.5 pl-2 text-slate-300 text-sm">
            {gaps.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-amber-500 font-semibold mt-0.5">*</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-sm italic pl-2">Looking good -- no major gaps identified</p>
        )}
      </div>
    </div>
  );
};

export default EvaluationBreakdown;
