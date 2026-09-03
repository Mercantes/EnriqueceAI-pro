import { describe, expect, it } from 'vitest';

import type { DailyDataPoint } from '../types';
import { buildMeetingsByDay, diffCumulative, linearTrend } from './meetings-by-day';

function series(actuals: Array<number | null>, month = '2026-09'): DailyDataPoint[] {
  return actuals.map((actual, i) => ({
    date: `${month}-${String(i + 1).padStart(2, '0')}`,
    day: i + 1,
    actual,
    target: 0,
  }));
}

describe('diffCumulative', () => {
  it('converte acumulado em contagem por dia', () => {
    expect(diffCumulative(series([2, 5, 5, 9]))).toEqual([2, 3, 0, 4]);
  });

  it('preserva null nos dias futuros', () => {
    expect(diffCumulative(series([1, 3, null, null]))).toEqual([1, 2, null, null]);
  });

  it('nunca devolve negativo', () => {
    expect(diffCumulative(series([5, 3]))).toEqual([5, 0]);
  });

  it('série vazia devolve vazio', () => {
    expect(diffCumulative([])).toEqual([]);
  });
});

describe('linearTrend', () => {
  it('série constante vira reta plana', () => {
    expect(linearTrend([3, 3, 3, 3])).toEqual([3, 3, 3, 3]);
  });

  it('série crescente tem inclinação positiva', () => {
    const trend = linearTrend([1, 2, 3, 4]) as number[];
    const first = trend[0] ?? 0;
    const last = trend[3] ?? 0;
    expect(first).toBeCloseTo(1);
    expect(last).toBeCloseTo(4);
    expect(last).toBeGreaterThan(first);
  });

  it('ignora null no ajuste e devolve null nas mesmas posições', () => {
    const trend = linearTrend([2, 2, 2, null, null]);
    expect(trend).toEqual([2, 2, 2, null, null]);
  });

  it('com menos de 2 pontos não há reta', () => {
    expect(linearTrend([5, null, null])).toEqual([null, null, null]);
    expect(linearTrend([])).toEqual([]);
  });

  it('clampa em zero quando a reta cruza abaixo do eixo', () => {
    const trend = linearTrend([10, 4, 0, 0, 0]) as number[];
    for (const v of trend) expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe('buildMeetingsByDay', () => {
  it('monta pontos com rótulo DD/MM, barras por dia e tendência', () => {
    const points = buildMeetingsByDay(series([2, 5, 5]), series([1, 1, 3]), '2026-09');
    expect(points).toHaveLength(3);
    expect(points[0]).toMatchObject({ day: 1, label: '01/09', scheduled: 2, held: 1 });
    expect(points[1]).toMatchObject({ day: 2, label: '02/09', scheduled: 3, held: 0 });
    expect(points[2]).toMatchObject({ day: 3, label: '03/09', scheduled: 0, held: 2 });
    expect(typeof points[1]?.trendScheduled).toBe('number');
    expect(typeof points[1]?.trendHeld).toBe('number');
  });

  it('dias futuros ficam null nas barras e na tendência', () => {
    const points = buildMeetingsByDay(
      series([1, 2, null, null]),
      series([0, 1, null, null]),
      '2026-09',
    );
    expect(points[2]).toMatchObject({
      scheduled: null,
      held: null,
      trendScheduled: null,
      trendHeld: null,
    });
    expect(points[3]?.scheduled).toBeNull();
  });

  it('usa o menor tamanho quando as séries divergem', () => {
    const points = buildMeetingsByDay(series([1, 2, 3, 4]), series([1, 1]), '2026-09');
    expect(points).toHaveLength(2);
  });

  it('a soma das barras bate com o último acumulado de cada card', () => {
    const scheduled = series([2, 4, 4, 7, 9]);
    const held = series([0, 1, 3, 3, 5]);
    const points = buildMeetingsByDay(scheduled, held, '2026-09');
    const sumScheduled = points.reduce((a, p) => a + (p.scheduled ?? 0), 0);
    const sumHeld = points.reduce((a, p) => a + (p.held ?? 0), 0);
    expect(sumScheduled).toBe(9);
    expect(sumHeld).toBe(5);
  });

  it('séries vazias devolvem vazio', () => {
    expect(buildMeetingsByDay([], [], '2026-09')).toEqual([]);
  });
});
