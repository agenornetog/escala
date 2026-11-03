import type { Employee, RuleLimits, Rules } from './types';
export const ruleLimitKeys: (keyof RuleLimits)[] = ['dailyHours','weeklyHours','intershiftHours','weeklyRestHours','maxConsecutiveDays','longBreakMinutes','coverage'];
export const ruleRanges: Record<keyof RuleLimits, readonly [number, number]> = {
 dailyHours:[1,10], weeklyHours:[1,44], intershiftHours:[11,48], weeklyRestHours:[35,72], maxConsecutiveDays:[1,6], longBreakMinutes:[30,120], coverage:[1,100]
};
export function validRuleValue(key: keyof RuleLimits,value: unknown) {
 const [min,max]=ruleRanges[key];
 return typeof value==='number' && Number.isFinite(value) && value>=min && value<=max && (!['maxConsecutiveDays','longBreakMinutes','coverage'].includes(key)||Number.isInteger(value));
}
export function profileFor(employee: Employee, rules: Rules): Rules {
 return {...rules,...employee.ruleOverrides,coverage:rules.coverage,agreementReference:employee.agreementReference?.trim() || rules.agreementReference};
}
export function profileProblems(profile: Rules): string[] {
 const problems: string[]=[];
 for(const key of ruleLimitKeys){const [min,max]=ruleRanges[key];if(!validRuleValue(key,profile[key]))problems.push(`${key}: valor fora do intervalo suportado (${min}–${max}).`);}
 if((profile.dailyHours>8 || profile.longBreakMinutes<60) && !profile.agreementReference?.trim()) problems.push('Jornada acima de 8h ou intervalo abaixo de 60 min exige referência ao acordo ou instrumento aplicável. A referência precisa de revisão trabalhista.');
 return problems;
}
