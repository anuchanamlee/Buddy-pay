import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { PendingParticipant } from '@/app/hooks/useStatistics';
import { Disclosure } from '@headlessui/react';
import { CheckCircle2, ChevronDown, Clock } from 'lucide-react';
import { formatTHB, formatThaiDate } from '@/app/lib/format';
import { cn } from '@/lib/utils';

interface PendingParticipantsProps {
  pendingParticipants: PendingParticipant[];
  totalPendingAmount: number;
}

export function PendingParticipants({
  pendingParticipants,
  totalPendingAmount,
}: PendingParticipantsProps) {
  if (pendingParticipants.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-4 sm:p-5">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success-700" aria-hidden />
          <div>
            <p className="font-semibold text-success-700">ไม่มีคนค้างจ่าย</p>
            <p className="text-sm text-muted-foreground">ทุกคนจ่ายครบแล้ว</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">{pendingParticipants.length} คนที่ยังไม่จ่าย</CardTitle>
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-1 text-sm font-medium text-warning-700">
          <Clock className="h-4 w-4" aria-hidden />
          รอจ่ายรวม <span className="tabular-nums">{formatTHB(totalPendingAmount)}</span> บาท
        </span>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y divide-border">
          {pendingParticipants.map((participant, index) => (
            <li key={participant.name + index}>
              <Disclosure>
                {({ open }) => (
                  <>
                    <Disclosure.Button className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-lg py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{participant.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          ค้าง <span className="tabular-nums">{participant.pendingBills}</span> บิล
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-bold tabular-nums text-warning-700">
                          <Clock className="h-4 w-4" aria-hidden />
                          {formatTHB(participant.totalPendingAmount)} บาท
                        </span>
                        <ChevronDown
                          className={cn('h-5 w-5 text-muted-foreground transition-transform', open && 'rotate-180')}
                          aria-hidden
                        />
                      </span>
                    </Disclosure.Button>
                    <Disclosure.Panel className="pb-3">
                      <ul className="space-y-1">
                        {participant.bills.map((bill) => (
                          <li
                            key={bill.id}
                            className="flex items-start justify-between gap-3 rounded-lg bg-muted p-2 text-sm"
                          >
                            <span className="min-w-0">
                              <span className="block truncate">{bill.title}</span>
                              <span className="block text-xs text-muted-foreground">
                                {formatThaiDate(bill.date, { withTime: false })}
                              </span>
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-warning-700">
                              {formatTHB(bill.amount)} บาท
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Disclosure.Panel>
                  </>
                )}
              </Disclosure>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
