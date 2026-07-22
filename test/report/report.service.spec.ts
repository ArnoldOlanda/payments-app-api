import { Test, TestingModule } from '@nestjs/testing';

import { ReportService } from 'src/report/report.service';
import { PrinterService } from 'src/printer/printer.service';
import { UserService } from 'src/user/user.service';
import { ZoneService } from 'src/zone/zone.service';
import { weekStart } from 'src/common/datetime/tempo';

describe('ReportService — TZ-aware', () => {
  let service: ReportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: PrinterService,
          useValue: {
            createPdf: jest
              .fn()
              .mockReturnValue({ info: {}, pipe: jest.fn(), end: jest.fn() }),
          },
        },
        {
          provide: UserService,
          useValue: { getAccounts: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: ZoneService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({ name: 'Zone A' }),
          },
        },
      ],
    }).compile();

    service = module.get(ReportService);
  });

  describe('getDaysWeek()', () => {
    it('returns 7 dates starting Monday in the actor TZ (Asia/Tokyo)', async () => {
      // 2025-06-18T12:00:00Z == Wed Jun 18 in Tokyo.
      // Monday of that week (startOfWeekDay=1) = 2025-06-16 00:00 JST = 2025-06-15T15:00:00Z.
      const fixedInstant = new Date('2025-06-18T12:00:00Z');
      jest.useFakeTimers().setSystemTime(fixedInstant);

      try {
        const days = await service.getDaysWeek('Asia/Tokyo');
        expect(days).toHaveLength(7);
        // The wrapper's weekStart is the canonical Monday midnight in tz.
        expect(days[0]).toEqual(weekStart(fixedInstant, 1, 'Asia/Tokyo'));
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns 7 dates starting Monday in America/Argentina/Buenos_Aires', async () => {
      // 2025-06-18T12:00:00Z == Wed Jun 18 in BA.
      // Monday = 2025-06-16 00:00 ART = 2025-06-16T03:00:00Z.
      const fixedInstant = new Date('2025-06-18T12:00:00Z');
      jest.useFakeTimers().setSystemTime(fixedInstant);

      try {
        const days = await service.getDaysWeek(
          'America/Argentina/Buenos_Aires',
        );
        expect(days).toHaveLength(7);
        expect(days[0]).toEqual(
          weekStart(fixedInstant, 1, 'America/Argentina/Buenos_Aires'),
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('spans month wrap correctly in Buenos Aires', async () => {
      // 2025-11-02T12:00:00Z == Sun Nov 2 in BA; week wraps to Oct 27.
      const fixedInstant = new Date('2025-11-02T12:00:00Z');
      jest.useFakeTimers().setSystemTime(fixedInstant);

      try {
        const days = await service.getDaysWeek(
          'America/Argentina/Buenos_Aires',
        );
        expect(days).toHaveLength(7);
        // First day is Oct 27 2025 in ART.
        expect(days[0].toISOString()).toBe('2025-10-27T03:00:00.000Z');
        // Last day is Nov 2 2025 in ART (Sunday of that week).
        // days[6] is start + 6 days (NOT weekEnd — each element is day-start).
        expect(days[6].toISOString()).toBe('2025-11-02T03:00:00.000Z');
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
