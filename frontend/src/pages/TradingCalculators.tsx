import { useLanguage } from '@/contexts/LanguageContext';
import { Calculator, DollarSign, TrendingUp, Target, BarChart3 } from 'lucide-react';
import { useState } from 'react';

export default function TradingCalculators() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [activeCalc, setActiveCalc] = useState<'pip' | 'position' | 'riskReward' | 'profitLoss'>('pip');

  const calcs = [
    { id: 'pip' as const, icon: <DollarSign className="w-4 h-4" />, en: 'Pip Calculator', ar: 'حاسبة البيب' },
    { id: 'position' as const, icon: <Target className="w-4 h-4" />, en: 'Position Size', ar: 'حجم الصفقة' },
    { id: 'riskReward' as const, icon: <BarChart3 className="w-4 h-4" />, en: 'Risk/Reward', ar: 'المخاطرة/المكافأة' },
    { id: 'profitLoss' as const, icon: <TrendingUp className="w-4 h-4" />, en: 'Profit/Loss', ar: 'الربح/الخسارة' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8" dir={isRtl ? 'rtl' : 'ltr'}>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
          <Calculator className="w-6 h-6 text-emerald-500" />
          {isRtl ? 'أدوات وحاسبات التداول' : 'Trading Calculators & Tools'}
        </h1>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {calcs.map(c => (
            <button key={c.id}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors
                ${activeCalc === c.id ? 'bg-emerald-600 text-white' : 'bg-white border hover:bg-gray-50'}`}
              onClick={() => setActiveCalc(c.id)}>
              {c.icon} {isRtl ? c.ar : c.en}
            </button>
          ))}
        </div>

        <div className="bg-white border rounded-xl p-6">
          {activeCalc === 'pip' && <PipCalculator isRtl={isRtl} />}
          {activeCalc === 'position' && <PositionSizeCalculator isRtl={isRtl} />}
          {activeCalc === 'riskReward' && <RiskRewardCalculator isRtl={isRtl} />}
          {activeCalc === 'profitLoss' && <ProfitLossCalculator isRtl={isRtl} />}
        </div>
      </div>
    </div>
  );
}

function PipCalculator({ isRtl }: { isRtl: boolean }) {
  const [pair, setPair] = useState('EUR/USD');
  const [lots, setLots] = useState(1);
  const [accountCurrency, setAccountCurrency] = useState('USD');

  const pipValues: Record<string, number> = {
    'EUR/USD': 10, 'GBP/USD': 10, 'USD/JPY': 9.1, 'USD/CHF': 10.7,
    'AUD/USD': 10, 'USD/CAD': 7.4, 'NZD/USD': 10, 'XAU/USD': 1,
  };

  const result = (pipValues[pair] || 10) * lots;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">{isRtl ? 'حاسبة قيمة البيب' : 'Pip Value Calculator'}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={isRtl ? 'زوج العملات' : 'Currency Pair'}>
          <select className="w-full border rounded px-3 py-2 text-sm" value={pair} onChange={e => setPair(e.target.value)}>
            {Object.keys(pipValues).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label={isRtl ? 'حجم اللوت' : 'Lot Size'}>
          <input type="number" step="0.01" className="w-full border rounded px-3 py-2 text-sm" value={lots}
            onChange={e => setLots(parseFloat(e.target.value) || 0)} />
        </Field>
      </div>
      <ResultBox label={isRtl ? 'قيمة البيب' : 'Pip Value'} value={`$${result.toFixed(2)}`} />
    </div>
  );
}

function PositionSizeCalculator({ isRtl }: { isRtl: boolean }) {
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [stopLossPips, setStopLossPips] = useState(50);
  const [pipValue, setPipValue] = useState(10);

  const riskAmount = accountSize * (riskPercent / 100);
  const positionSize = stopLossPips > 0 && pipValue > 0 ? riskAmount / (stopLossPips * pipValue) : 0;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">{isRtl ? 'حاسبة حجم الصفقة' : 'Position Size Calculator'}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={isRtl ? 'حجم الحساب ($)' : 'Account Size ($)'}>
          <input type="number" className="w-full border rounded px-3 py-2 text-sm" value={accountSize}
            onChange={e => setAccountSize(parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label={isRtl ? 'نسبة المخاطرة (%)' : 'Risk %'}>
          <input type="number" step="0.1" className="w-full border rounded px-3 py-2 text-sm" value={riskPercent}
            onChange={e => setRiskPercent(parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label={isRtl ? 'وقف الخسارة (بالبيب)' : 'Stop Loss (pips)'}>
          <input type="number" className="w-full border rounded px-3 py-2 text-sm" value={stopLossPips}
            onChange={e => setStopLossPips(parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label={isRtl ? 'قيمة البيب ($)' : 'Pip Value ($)'}>
          <input type="number" step="0.01" className="w-full border rounded px-3 py-2 text-sm" value={pipValue}
            onChange={e => setPipValue(parseFloat(e.target.value) || 0)} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ResultBox label={isRtl ? 'المبلغ المعرض للخطر' : 'Risk Amount'} value={`$${riskAmount.toFixed(2)}`} />
        <ResultBox label={isRtl ? 'حجم الصفقة (لوت)' : 'Position Size (lots)'} value={positionSize.toFixed(2)} />
      </div>
    </div>
  );
}

function RiskRewardCalculator({ isRtl }: { isRtl: boolean }) {
  const [entry, setEntry] = useState(1.1000);
  const [stopLoss, setStopLoss] = useState(1.0950);
  const [takeProfit, setTakeProfit] = useState(1.1100);

  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  const ratio = risk > 0 ? reward / risk : 0;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">{isRtl ? 'حاسبة المخاطرة/المكافأة' : 'Risk/Reward Calculator'}</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label={isRtl ? 'سعر الدخول' : 'Entry Price'}>
          <input type="number" step="0.0001" className="w-full border rounded px-3 py-2 text-sm" value={entry}
            onChange={e => setEntry(parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label={isRtl ? 'وقف الخسارة' : 'Stop Loss'}>
          <input type="number" step="0.0001" className="w-full border rounded px-3 py-2 text-sm" value={stopLoss}
            onChange={e => setStopLoss(parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label={isRtl ? 'هدف الربح' : 'Take Profit'}>
          <input type="number" step="0.0001" className="w-full border rounded px-3 py-2 text-sm" value={takeProfit}
            onChange={e => setTakeProfit(parseFloat(e.target.value) || 0)} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <ResultBox label={isRtl ? 'المخاطرة' : 'Risk'} value={risk.toFixed(4)} />
        <ResultBox label={isRtl ? 'المكافأة' : 'Reward'} value={reward.toFixed(4)} />
        <ResultBox label={isRtl ? 'النسبة' : 'Ratio'} value={`1:${ratio.toFixed(2)}`}
          highlight={ratio >= 2 ? 'green' : ratio >= 1 ? 'amber' : 'red'} />
      </div>
    </div>
  );
}

function ProfitLossCalculator({ isRtl }: { isRtl: boolean }) {
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [entry, setEntry] = useState(1.1000);
  const [exit, setExit] = useState(1.1050);
  const [lots, setLots] = useState(1);
  const [pipValue, setPipValue] = useState(10);

  const pips = direction === 'buy' ? (exit - entry) * 10000 : (entry - exit) * 10000;
  const pnl = pips * pipValue * lots;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">{isRtl ? 'حاسبة الربح والخسارة' : 'Profit/Loss Calculator'}</h3>
      <div className="flex gap-2 mb-2">
        <button className={`px-4 py-1.5 rounded text-sm font-medium ${direction === 'buy' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}
          onClick={() => setDirection('buy')}>{isRtl ? 'شراء' : 'Buy'}</button>
        <button className={`px-4 py-1.5 rounded text-sm font-medium ${direction === 'sell' ? 'bg-red-600 text-white' : 'bg-gray-100'}`}
          onClick={() => setDirection('sell')}>{isRtl ? 'بيع' : 'Sell'}</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={isRtl ? 'سعر الدخول' : 'Entry Price'}>
          <input type="number" step="0.0001" className="w-full border rounded px-3 py-2 text-sm" value={entry}
            onChange={e => setEntry(parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label={isRtl ? 'سعر الخروج' : 'Exit Price'}>
          <input type="number" step="0.0001" className="w-full border rounded px-3 py-2 text-sm" value={exit}
            onChange={e => setExit(parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label={isRtl ? 'حجم اللوت' : 'Lot Size'}>
          <input type="number" step="0.01" className="w-full border rounded px-3 py-2 text-sm" value={lots}
            onChange={e => setLots(parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label={isRtl ? 'قيمة البيب ($)' : 'Pip Value ($)'}>
          <input type="number" step="0.01" className="w-full border rounded px-3 py-2 text-sm" value={pipValue}
            onChange={e => setPipValue(parseFloat(e.target.value) || 0)} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ResultBox label={isRtl ? 'عدد البيبات' : 'Pips'} value={pips.toFixed(1)}
          highlight={pips > 0 ? 'green' : pips < 0 ? 'red' : undefined} />
        <ResultBox label={isRtl ? 'الربح/الخسارة' : 'P&L'} value={`$${pnl.toFixed(2)}`}
          highlight={pnl > 0 ? 'green' : pnl < 0 ? 'red' : undefined} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ResultBox({ label, value, highlight }: { label: string; value: string; highlight?: 'green' | 'amber' | 'red' }) {
  const bg = highlight === 'green' ? 'bg-green-50 border-green-200' :
             highlight === 'amber' ? 'bg-amber-50 border-amber-200' :
             highlight === 'red' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200';
  const textColor = highlight === 'green' ? 'text-green-700' :
                    highlight === 'amber' ? 'text-amber-700' :
                    highlight === 'red' ? 'text-red-700' : 'text-gray-900';
  return (
    <div className={`border rounded-lg p-3 ${bg}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
