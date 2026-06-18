import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { showAlert, wireShowAlert } from "./src/lib/showAlert.js";
import { buildParentInviteMessage } from "./src/lib/urls.js";
import { authErrorMessage, dbErrorMessage } from "./src/lib/authErrors.js";
import { alertMutationError, catchUserAction, logBackgroundError } from "./src/lib/reportError.js";
import { requireSupabase } from "./src/lib/supabase.js";
import { useArtlogAppState, subscribeQueue } from "./src/hooks/useArtlogAppState.js";
import { useFeedbackReplies, useFeedbackReplyMutation } from "./src/hooks/useFeedbackReplies.js";
import { useMessages, useMessageMutations, useLatestMessagesByStudent, useUnreadCountByStudent } from "./src/hooks/useMessages.js";
import { groupLinkedParentsByAccount, sortFeedbacksRecentFirst } from "./src/lib/mappers.js";
import {
  defaultNotifyDateTime,
  resolveNotifyScheduledAt,
  formatNotifyScheduleLabel,
  dispatchFeedbackNotification,
} from "./src/lib/feedbackNotify.js";
import {
  isWithinFeeNoticeHours,
  msUntilNextFeeNoticeWindow,
  feeNoticeWindowLabel,
} from "./src/lib/feeNotify.js";
import {
  DEFAULT_STUDENT_AVATAR_URL,
  genderLabel,
  getStudentAvatarSrc,
  shouldShowStudentEmoji,
} from "./src/lib/studentAvatar.js";
import {
  exportStudentPortfolioPdf,
  exportStudentPortfolioDocx,
  portfolioExportSuccessMessage,
} from "./src/lib/portfolioExport.js";
import {
  exportAttendanceRegisterDocx,
  exportStudentAttendanceDocx,
  attendanceExportSuccessMessage,
  recentAttendanceMonthKeys,
  formatAttendanceMonthLabel,
} from "./src/lib/attendanceExport.js";
import {
  getActiveAttendanceStudents,
  getParentEventsForDay,
  formatScheduleStudentNames,
  isAcademyClosedOnDate,
  makeupTimesForDate,
} from "./src/lib/scheduleRules.js";
import { publishMakeupNotices } from "./src/lib/makeupNotice.js";
import {
  getCalendarMonthKey,
  buildMonthlyRevenue,
  getMonthPayment,
  isPaidForMonth,
  upsertMonthPayment,
  removeMonthPayment,
  paymentDateForMonth,
  monthRevenueTotal,
  syncCurrentMonthFeeFields,
  daysUntilPaymentDue,
} from "./src/lib/studentFee.js";
import {
  getNoticeScope,
  filterNoticesForParent,
} from "./src/lib/feeNotice.js";
import {
  createUnpaidFeeNotice,
  dispatchAcademyFeeReminders,
} from "./src/lib/feeReminderDispatch.js";

// ─── Design Tokens ─────────────────────────────────────────
const C = {
  cream:"#FAF7F2", beige:"#F0EBE3", sand:"#E8DDD0",
  terra:"#C17F5B", terraL:"#E8A87C", terraD:"#9B5F3F",
  sage:"#7A9E7E",  sageL:"#A8C5AC",
  charcoal:"#3D3530", warm:"#8C7B72", light:"#D4CBC4",
  white:"#FFFFFF", red:"#E05C5C", gold:"#C9A84C", blue:"#6B8CAE",
  purple:"#8B7AB5",
};
const LOGO = "data:image/webp;base64,UklGRvwhAABXRUJQVlA4IPAhAAAwgQCdASqQAdwAPmEuk0ckIiIjI7RrGIAMCWdEHmStkZp83La7YDY+tJgg8xyya70JeloyELzZ/d/yR8Dv8B/a+8z9B/bfyO5uvU//V9C/4z9mPz/9w/dH40/yHej8av9H1Avx7+Sf3/+4fuv/efjF+q7IPXP9j6AXsr9I/1v+P/ej/T+m5/e+hf2T9gD+e/1n/kf3T8guda+//7z2Af6H/dv/f/l/dm/pv/d/ofyy9rP6L/kv/b/nfgK/mn9m/53+K/Kj51P//7lf3n9n/9yP/+Ulot92krIZKW+HCf8FCAmhKaeKdE0izPQkCi3hk4GX/6/3MIXHdW12iGATmvt6Xba/DlbxJ0XnOiKvk4VcnpWxRNcY/zN7XFMzln5089lKmwfyKE544AN/u319rrhc3gHn6T9gNrubgQqBx3l8dH+5fDXybDG1aUlnfF+8zIRwJbCJ0MG85cmoHtEGFuG4jcwk+97dfp4IAbBLj6ZRM2ZYL4ZLpgx2UgWVnYf/6PWbVHVYw1sNQebcNUYPk+qWuLUakXMa2s2irIJbv9sWRNbO4GUeeDP2hItwS9jJDQ0qJCdVq7P3BI1FtKZoB6UcH9D3/EQFvs8BD/dIa/1BmYy4Z3RCzRstixeqcSufkwq2OsYJo/8IIf8vUF1RQFn4gv5NJxrckiwwy2o9sNstQwEqAlS/vUS3j6ROABPuye7+BSG9O8u0u+1OW4qfewPTD1Q7hQITPSjToCaYorsxFUQarJrhYH4oa1sdPFfnPZxE7kffkoxc/3/bN9k0OKLbaxR/46FjXqn6SUrk0+qEVSSU1LQOEhDW3KUG0a5oxwCWPuj6GfKGHKtK6lRt27whkooidHEuPcfD3YS9Gesktp95TuzQkWl7SGoIra2ISVyCj0jx5ilBbHCpMcEDE1QDt5Ch/QZybpQhkOm2tSTcn2A2UKclva5NbrU42ox6lIxfPVKDdBBXy2opR6Nm53+vmSvZnbcDKxvz/XG2miD5e9+/OFhpF/3l/hde1pqjM33+xSiGGrTc0rG0VRlCMtcN0OaEAl/C1Z0HEXUPnTeXcZSQ5DvnpAmC69ke2HZualnRm/xd8TIMXTQgLqspEQZplmotSkkwnWMP9N1WLGJAUkfsEO9n/utmRN2dEx/0MPKoX8aDZzDM9zjION/2DfSRd4dtj6L9It26dq0MfMmMXSUCF4RjkB+QtTBbxhXXQL7/ATs3cHS4l8nhXZvr74Z1P7oqlDxa9hV0ZTsrbPEkzCmjBP4oFQviC4Zt3eJ4pfj3VXgJZJtakgnazuvPCeVmaCyVvfOkO4+sBhnEB4SDVKNWmoeiPOF1rEz6FBIHMp2rNheQ/B3ncksH3K5w3MKhYnPFGXb83AVSHEuOp9v5OagAAP7NdK/6u/O36nxA/3Q99XlUDuz9ScXgxwVaoahkTgg4PVQdQa27dkNOVw9uMP92JyadWAMODxhQJQu9LoL5t9hvfwCnbg4wnTdhHLYMKeWTokPD6hw8JeOcc1eV/UQGfagUwzcpFOjcmQsdN6Ny6+od3N0nMQiI0SA9rhm8EGhu7xcHILPEaIYyYnCCkjXOkSD984a4mbiV8K9UWaHdZL2dYDRk0oXGfXC2ESSdRwZRYZvVCu86iXav404A4F1Zf//jK3qhQAApRpTo95tNtX//hipBI+IEVghruN7aLNrzBhhb627kMebQSFJJrVLPF05fQHwx/bBtPMwlbGFAMhDqAAT1VkpDK21wMlPHw7njZ59Lwfxj3t4okh6YhZ4CL8DA6UOpzQ/RTFsjwC3Ap5zdHCXP38mqHK+E8encX/42hEwmDKvaWnGwptaaW8Hu7aY8LU51EiJxBN/FDxa7kjDmoZmV36YxTK/lNaq9xjQ5dmloRggEBcNS7of/uLgdIbd8kuO39vJCjmht/J14+YRRbtCHgkY5VgLjH0yFX1zo1vt9y/RM3CvreP7tSGAgb6wTAoV1PEHPqRaPg6D0T7pNtK5il8a58ZR4f/mfS+YZA1u336YByghjzPVQMQ4ohkJNNdrSz7eXu9VCGBDrb7p+noa43zNFGb1iRV7I9sJa/gQ/3IHsftSrqETYDAERg3N6Y5FU/uRtaLk8vpjYfzCCJjTrYFwr4a4+eINE+TG0cfDH319M/5CalJpPn0QAGgOlqq8lQU07zTAzPOU6vKqltqO1ZIANDhU9wxfUp6lk/NFWjyzBtdnZp1e64mnq4sQnF5iwD2cQWaZTmRhGzjvTiZEIrK9j7W4YVKwMy5cRgIy/N291IJ1e9sisjTEtjJdpbwrM/3PMxEkQba33gE1i9soyawvrC28dDdp3ydHe08eOggHuGibrG22xMqEcj8ysD4zrWNaoUjxvChJ6c6zH4vdCMAZ1fM88Vdz0kat2XgufEfWAVcwnmweI7/huSwflGIFPT45+xuj0NNgc0gWrbcAHCi3wJCdFZOvFiISzeMdZK3f7tJF3BDcCG7hNFoPQnO5ku7wgOUeZKp962CAjzeH5RKgRjkriPACfF2Jgj6XLSQ8ByYE8RGlBh+Zks0WkrfVXa5RA3ViaxCAVeoAdUB2L7RCT9Osk2zQIeBW4Soi3B2BM1MaZWPQAr5nM86cGAvCwF6r5ooJMIBHhQLWyvGEw/pHTaQ8SeMWR3/JOAiWVR+W5ppwywyH6UvBY4BMPaedoPeIkT63WfogBFQrBCCeNJRDuLjS5WGRDntvuPayyDwr4rpBfldB6vsWJHZmvW+OGtGK+d/DWhnV6nUlU8XKip2f32IDmlE6Zu2X0u2s3Kxiu41y2dUNkCXSqaIp7iy2oWvfTTlPKGrPElnGD/pnV1gm7f95q52B82xV430pYi6z/7Pk02QbVEwy6u9ccMNewUYI4Pt+Qf790slEDF/7KCtIDT/0/TpbH3ZF6GPAlLvYlCMEdV1wQg8neV/R+e8PjCQeQH8k7A/wpR3IPQlXnF8VqMVO4dfocYUdHaUbTBtbXzcw79Zde0tDh99FGlk3LsPgnHGjTauW3nTBgLI/hdMMA4aVbsfkBBnZCtKfiR60cLZ66TIOYmC/XzbuMjSORZJvbgeCK77ogB3SvWIi7eAwrJIV9dMbhLmlkH57tJQM6x1IGcaEJcij8luyUKN5nOPJjplkR44xWL4ZMXPBJus6F5x8YwXgnRuLyBCNP26nYDrA/FAN19dDEBpCOgvcodbP1eeWrjdAKjaPjQKPM/VN1khBjHp5SWU55eGo5b2yYV+ADN6m4dRHdpBl/RTGLrgOp/K2t15dWjHc3sTEO0EwL/24coKToKmBPk+si7aQRAD7lCzM1obHXP0hPfWRfhNzb/1jCmBlzujSmM5jipyQLM8N1glpxkuJO0SZ5EclwAHAyr4eyHgRmYmvfL//blwijYdDbp77qUGWLaCccLSwZw2LOF7OTpJnvSYKjx8scIsaTWpz5/zotiuS0eA3alrnuIl6rzPzk5JP22AfFfQZryuwqN9aKozGne6LOz+13hW9Fr1G5BumBqFhT0TRA8VuYh+P3XwyVnxjfAwZyN4jk+hyRU/hkMKiK0dpG9rqvC4edBE8Gv9lhYUXFSyPf6bGHwxo67dKOoWlpIWhtfsK2u1P8C2CJtyxtWwxoYXH2rRI1XJDtzegLYJt3K5t/ivs3CqWCDwV3029P6Wjl+JfeCX0gVQLYsm9NeyTWs9qNiWXK/5q8bESGsg3KmHI2hSdiZg1N8+DmXfmSbJYP4YCkwGQjBY6gHO62bP2a/jJwqvuY2KyKmANr+IV7GgWRWGjAFQeo71NB1HcoBd+vrw0QTizR+WhB06Ouei5H0rhX/1a4NC7f8eqvtxYf3A/XD5kAmMe47+3ijHbWpGx5pILNNXYBBAzaGiLP/ZxcD5IDvAM1nKZyC9C97K2Re+PzS2h4CgVVzC+KLOkX5JcraEjXxvI2APFFJIegneWq9KzhJY8B3l3J6vTNw+7HxLR/wpv0EKK61ROGbNHrPC4x3OOaoX/UCFTkdsCHPGqsiJAZQEr3b4l37Sh+FsmKUTRLrQXWsFOzfRR5nyh//Y3WKzGO+JFgDn+ujfHGJgOt10PVHuki7CURLgjpK1Tl8qOvLcPzf4P0qXDGj2aEdDNTH4BKkQtFGGcUE4Uz9TnCsWbjiaYNn9VuzBtZxV55Z5on31nlDNWKXT7yJJKJ/uBdtSeU7jbXB9j4nNRhTVovCXBtBS88bKWjeFjTs0WppGlk2Myvt71pB7XqXew8/Zf9Mhlr51UxTqqIwbofMK0fxX52P7zzvVoHv6gB+/eE/XcFeRS2B0vrFNWqR0FLoOZ78GznvccqCGlhrraUGXS3FrMLG0Sw6G4oGPb9bO4JRrV+0CKituwFQ8M4B5Q4SxwNX+SX2gcVwvrVZupFURj3P+DYot5bGSfdHGrFjYoY53JE7zSmLawcocMLj97YgMe5HGTVeM7hEVW5Wdk1qxN7En1qFIgXcpf1KBrf9sPuNbN9X7znQ3IUIWX+JeUWbmmhNvEXzr1frqPBrMAve5zvjuvjLhAck52s7orvAMK8yEEvqdyEBi2s/OWGbQcLOmo8CeArg/p+Tuugs4MpZimQL7/B+0iM/9wV4j4Bz0T2Zg9G1AhupApGpwYg4YmAtY9WLchXc3aRZ2AcydJZRq2IeFfrB9E7ZEPUlez/nglipHrkf7LIs8sFMws59EkB+IMuamqeKreJUETTWLE5E81cYnBZiij1CGP+D/tGzGDc9GwtNlqGHpkHtVU8whgF5v35oNzAOe+3WneWKXLeTqBgux6m95Oe9ABkJmUTa3svo7li9XkWOro0bN6iP+NXMrQgXUGRSOMVBhmB17xMeZz0xbjSjOsNYw16rnBMQAaSJ0eB7vFzSSUz6DhFZ3wgZpHiDadz3T52a0V1WhPo2A3Cl2ic0eAcGXHxrVdu/xFKVHd3uYHPpdB0kf800B9nGYgxV6NUiY0FgtCUgOVpL/BPi+XQms31Q5kWhyYsWWyOgBzNJM5z0jRnPCkYlBMTkOggVvZhODajCvi6qS2S+EtWwa/Z6QLg4m/A+jYf4MMWd99nmLEowp7/72MGGA6YiT/wQloRAOv5wNOIgrzXOE5BcOuZBFartNtgB4t/I6tjS1rZFeX4a+93lpvS8cDi0CzJeyMkXpVEmHwq57UHmkyNLciI/VQeXdJjATlvgKPAmv2/8ITqVKvyhSFSWRVwoflupoYimmq+q6lLTZKlqVk2NMYeqIH4uMHgqm4PDAGShSzRYtMeKfo0GfjtocToh5dQU66B6oy3JSJqiibLZ9Fpu698H5nGg9x6ZkfiFPSoNgN6fQDlvJt52FB7++SjX3eMVgv9SFJ9FQcGi6oxng7WknDGOqkY/LKUPOYMJB0CMOltyYneVzYipi/KUEdT8w9rNP1C45O+2w+rJNjtP1SwCBznskQgUz0Uvung+pcO6msIRz1+6R56STw9lNuMksENUktRaEwIj1OvSQ1MV7ZXTVVf1pA6E8cVurD58Yi28r/SxRXdIvRJZh4STVby8X+krl4miJLdAeFkwI6FZWd2DB2glaaY6vIDpdFHbhXjf+8eHIqemHey4gYa/PyKDWwdpJ36NHsAQy/vtt0eN+djO3ZClOdU7rt5ykV1WCuDYAQtkOLVBnTKkxXasByAQB5lThqQdoJ00gkFnnKZDv78eIbLjMZFgwLPEnJOcYnQtYoaSVb30VaDU/BlD4DrPwTRVFqFpvWR4m7bNvQrlTeq8O6Czf1/jyH9l3/HTOrRNWyJ+XE/lf/+gKw9S/5IA9TjyECODE2zjC59T/XC6Rs/Xv9z73rM8KKJ3JPsoBcPSFRxIJ8aVia7A27r1dTq8o6xoLiLChwGrk9nGLB2ruixgaJ0JwzUkUALfo1nP4SS1kAIioV40aqZk+SI5/mO4Kjx32O3nmx5sCOgZLJtwdSr1ky/8MO6dCkeu3+x+tW7OdxJMJ6S1TUWHKcf9piG0KnBNGRcQM2yqI8vBGxV0FSN4eCFW0HzQygcCeb6WJvtK6YiXojOQEXLvR+Hs+w5qjLXUSsWNw9XRmXky3wWDOtQHMvF76o+nGVSGdqMLCUW7yPARszLmjkO9hJr5RzEFSVm/1TkfOBXvSImTwQa3Hx5FmWmEUi8Qg9A6t3vDdvQFd5TvPa7Egq73y0/oNlXLMBYe5wy81NsEl6M/A5bAJd2cflqw+vrUiIJvcT11P41GZ5ab8/mjL87o+KawxUZC6OFobxsIl3icbiTuPkD3CH0U4i2PfkiaKGUYAB8jakg8lDwtL1KJuqg1REgAF88khjyZEreMJHmAWGe8YmA6Hq12SuZ6F7lZ6iI92BloAX5M02Kjh+1tBbwn2fT5IQdEN3J9U4FYORHLnCPX0hhyT3JUn4nxC3BzbyZgtBWkm+FxuiNQHf4eiRh0+AosZuneY+8MWjxowOaRHXaX7S3mkKKK8M6yh9XqUQEH4YKqMRpxIbGE8hOJTHBzkJPXbNrNlZKHsTfVowaHTqAqoQJ4guMFH74CpB/RTyLsv8on10HkspieNiGFol8vBQfmKH2eZ3xhDCfOwB/vdoTh8e0qXoy+B2N5KJyRQuHOB0Js3i6CGciwrInmy67Q0WLdi98XdN26FRSwxiaECpKVLyDbThsGCmgPh4Jj8ls7DdiV+gCJouqa6UvIBBrDxgcAHeQK8CYZsmOBlj+Z+lQ5NdIayZp1bG/WB44PoC2XDSL/ZSavTo905Z6ndA7xMP+Di7Td06GmdaOgTlu7iKJCv/yIO3mwbKdaBKzBpGpaA4ECqxR1wIiaUoTLVSnuGrwL+Zokp3JInQI9Uh7Nj5vFzpNYFzKKw2aMY28ld+piK5afi80h8L7Lnu1cB4jIxNLdQUpIl5feIgAlB2bvBzdG1a+BQJqPMl06b/5IUpdKD24Jy1WYmBeBNQ6TijwBjlo0xnL2yvB0JE9UP9nDbOEhasuBi5H+iVogbS+4tUYMUrbXXZqmEPHzFcwRVIhJEYFDabb0UFAvbK4BoK++0TrNRuQ/BW7agdAqsH3L85o1lIPpnhqtOtu+FbDS/gpktOb7q3A2kPUQBwuGNyxzDcmkW4EAvPYKu4ri1o4EUxeQk22AOswvcW+H+TdAWYwj7ge2A+FQDAf9MvR3wTqkn1FCuBE9o91GrKlVcazer1RbMcngnbFHoeoph9cZQn3EKSgsp887gSk/J2lzi+X0vHNijykAVZepcXkcRpaIr/iNAXO70yADvShwDz6ElcLjBxgSChZ4riZ/LYtt/6UyuFpH8i6GsBMz+MJzGx5tKaM9hezFWKvscysu3YLnxzDWcV5v51hBNytBKkf1kErHA7dtpBB7n1Lx73DNUGJtTirZf0rDzoaBTkPnZd2+7qc69WUkHbgVfw77q1MU6LjjwdOR2F4knQh+NccsDdWheZTavy90uaJoALVOWEbdV5zKORbT0Ul0ndFc0X3XbkG2bMKFRTflW7oQVN/5gg+Yt8ZhsP9Ta/SvAubsnX3QF2+J1vbViHPyXXNAkcJVaPde3cupLSq6DG6r75qUg5h00jmuQRmPj1fCe6YCgmVeit7JTr4ddL5g0i5HEyDdA8YfDpFe5qg9jBUUTXLJBSN3ezcYJMu0DoTWPCOzUda8m5uadtvp6B23SOFFQuuidehF4q9foDiarZw1Zoti/GuBcRu2gsJiJISpjcCmCfwtaF1T2mTU447t1DnNkmYmx3b++QkKQfa1vYEtC/CTBfeahbPi7bO9h28ELuvUhp+fx+5yWAvXOijS7h+Kj5xa+tHILE/KWTUYjRXQ54QplT1g6IdmfkIqwOhwdaBUTP5K2ijreOpLBwKh/+ZXutb4CJYXz0G+Oj0iuftgTqlaF0tT2X+uPhz93ujcWySFLSGUF0oApVWLMfaxZ44XoqBG+LV/SskrIRlz3AtlC3lkJ4bZ0pWVwSVDY9ZMUMNIYYN5REwjWCi0fysHvGly9kDufIfeZHldCd8cuJtzPfF8S0jzejclKzA8fVRDqrY6rbQRCCFMiMUx6zoJDoBjRGu5F2vm9TkPibZAPdwE66oSnkASFhE1r3elkATujh8c6E+SYcfWstlNPzVMDIgc5r4QUGXad7ufsIYOkynDt2/w8REX45WZ65BF31o3laYiZ4FJu4sxd8Q5AdJhaIhODkwhp9jdR/AUDpL3EGxxg5ogIGMzo2FRcKMHj4/TYYJKREAFLd7lNLB54GPOHYKqxZsJ36cYuMgLJiseuv7S9eJPh7TDasHItGQ/N/bL6gxRlW1PHdIYNIuOYa9nak4rycuQIqVPFUAi8kVOjBdSIzxULsOU1rTrEsSG9F6mPuwpHI8d7JQApm8AOinp6D3Ld8C0y7Hd4br/Rr1AJ8iquK/Xi3vDFIzcIbTTpOXqmFc8pvil7/AfNsWPBJ2zygfmI1/S+K28Yqu6UzAUNmTrendQN7L1uY0lY4+/TtGrhaED31XYY2gXmcgCmTFfwC/iRXVOjIWnsCh4DgZy/Ka7MyWULS05Djpb8LvcseGZ7TPCZVneKZWSZM+/Q8Qga2ylGUVgF/apDEWhUCL6qVoeuPJ6OywF/FH+vPi6quRgxvSn9SLOpir061n54Kmi8GLcDlfs8NXhqlYlgzWRLZh00tMr7s3pF0TrKW3DsnEjLzZAQTarUCd101+VkzyXFZIWBF2GgkgwCogWMJgr0hguyLFjq93TCChOf+SaJxo/fS35WTbXyzM2aLg+g6lAk84a83PrT89VxbBLrwJqdCtd8HFnjzaXEO4ObvndTsi86xehp0HBeuU+4BU/PVTRIcVz0W2fI2VRHnFFL1X3/RnxuSw5le/8Zb/WSWYlT+qJzPT6GI5mZ/S0/FbjvJ1T2O5adgiFn2vgADPYyOLV9Z6Bqlfxf9PLT+SPCe/C/VC5N82SYoz+NdUmcSRhiCpTsKk4Bp2zfry0eRuYY4WKAv22AEv53dCD221Wn7CkHtvd9GoaoXbdOgBVNDkszuPkIXp2nCNXoqSsIeugEcKwMw/861iZioAasUAo9NJQ1ZpNybDZNLkW5M4Vki1R7nIltbbSJzVMmOM4MLj1jtvUeRDH+xW+zPGvrBgrw6ZtZ7jo0xEmTNDjeJDeFPfEz6zMe0Qzqc5sVgwgBpHPOFX1fK1JC69XWt+DuqGYHPK9p2vtQpClTpeUrUK7T36SavjYoUsmHreN/RaaLQLqyk8vxc6zW/xIBVsSRRtdzUcNnIs0odNZHs72PcQCqj+iwD5OTjMRXymv6y2EjsMtXXy+4dHkbBf+1/3aSYCoYUmLDfy+uo2SsBZGVSEEVNp31Z4oIQLpfbxap5TG4Ie9KcSpZ8TdFg4P8owKGVz2Up/08YV5lAyWRJqbxVHkCxz/tAoBWrIe7krh1BAX+u+tXoVG/tfIR2PT0PyhI6HsOpOqkBkLmEzD/bor7/Pe6HiI6cQxswyOwK3qDJsZFaxhOTBneTbPLRDC1p5UCwkyxm5gkdbGg1u/qb5md39hu9w9SpNswQX4ULejm7kPo6E5KjKKAxKqldPxTLECbRwhln9CeEbTImT2Rm8yZWUf26hCYbny8TibZmu/v65U7HqhRNV9gTUvyBK6BWuM06l6Zxm/2NT3L8OKribdRxNoe2MCNlNRNQlsASYbs0RxjFXgH3FoLyy2OYQr0jOJbVNtab1UDXH6n+mc3/cZDqgYDNDL+EyvXr+z2g0P1f8btz5kuCCmuPSgUdV1dE//QwTV5UZ55+FTW3zBXH2BONneFRG03wrE8kfcacs9lDbuLlfu35fBKQBD49yWA7HBNdB3tE6SQjTD7FLCRkDRFzoQTNpiwcp/zc/Kz8925+t1DKj5O16QY1rlRPMtDIgcuZifmmHp186KI2QXDVsQ73y72nijfZ1Srf1SL1ExMKoxfSjZ7VnP/JZe4zhaybwNHYDr8xSX5LIDvmHCkU8wIAb7OVjRzVlxWweB2i6pLdqXKDu6jh0MiKYLqc6t9H/wyNM85/0BNP4wHUIfsvsITWlsq2QXPjci2oLHTUZwNTsVKNe8D7P2G/unZcKXBFMP4s1kO/SsWoTPfefHkNP4kmOrAtiTXa5NMBiFnAEPV5EsFVzXpc+fZlazxmALJXEhpZ3gL+t/T5R5I3u1rvvbIe6Uh8ulEnh6kjEZvNCx2hN7aBVmV+aEm4IU3Vw+5KFn8U1jIZkPIFKjX5vvHhTnvXwt7V79fYXylXtdgjlFYDYwMBShDi2vFS3f2fYYq/gj6V7FhxlE+zLSKr37TeMXjYiCpgwTFWVCawOkeVBR4Bad7Alp4/HKtnSAnEtzI57ANPqfF3s9pemZ0BaQA4nRylo8bodgHduL1sXjsN+1rOdqXAkjQ9etsONzuhcqsFq9I0r/e7TZS2xKEw+YToOjTcDlRou4/N9ESGaV+PRCTj19t0dHnPKZpCH4uiHsrUqfjq4Z+DqW7JMdgb1Jnb5WhpQBmnTnScr3TNxvr2jVFr9SpuHQ4C8FgExeD+XwJ2LPjSMGWTHb/ELgLXIVU4gTRCic3xAJl00GfVDQizUTj2XzzOY3MRN2/+OIXvJ3z8lV1P3cecaKSv4pSfrGHedmer7dK60Ohx6Ho6NyuwHK2ku3p8gt6rkthSxtSrG2ji1aFp5J1TwzpVNOrqRbIMpXYHNIczyv/DmJL1JoP5DjHCkc9vbX+f/j8aW/oUgsHqWQZRMUcjEFV5Wy+WLWPfuA2usuzbqAQtGxlpWL723olQRBulhiDtqt/O91d5O2L7xyJF/hfhP9JsyQrlRA6yQoTLZDYFTkYAKHtiIK7JR8OsBe0eiwCalGGNcWTuIVgBleFHWuLMgZlE9BnxtehUD8r3io1drr22OFb7lBoihem72jvinIfBUM8fJ1dMo+7tp7SzQWmqX/fmh8DC1m+i3YQG+J2jSQlOfxOLTzS6NHOzfFd3xPwt6g96E3UWdLOg+jJm4phc0EDA89KPlxVthOxMEahAjFKF7VEMZADY4d1zZnHJYsMNtK5mRrS7jygxbzius+ZE9vSg6hiCcQdgeJqK72aAABLmFlJNNXTctizyfbwBQAAOTt0A04WT+gObDDYW2snf19hOoIgRNbIjOTSL1s8b59QBIiZnMlBM8Hx8GXrr72XxYL+xLFgf50w5wCx/heCp767pbFKxlWtjYabZlQbQCYy9p3xbxvNNqcMjjeLJoHF7hKoGjjbxA9bXmmGoP+rfvBnIAiIZn0ApMr6DoctgUo/pp4yhXdTnrmJ95YGMJ5jQyf4jgFDHlHj4fYF/L+QcQFy+eH9ULJ4fynLVF557KgC0Kn+EIPy7yBMFL11hBoKUz8Y17hvjdQV2ZQioFbxAwLkATVZYLYlAXl3sPa610am2ZCEfMhFR9gGC0AzQSbAQCKkVNBirRvyExfCi0CVru2Os0w93wZ9xhCsMXZZxPxatNAr2PisEpv72epCH38wJtO0nQDQ1wqJtnNi7UZ2ngBRG5/it8olRh2j+Ui5IPGZb6YLfwvPJ6E10kBr8MR2ZKl9Apm9FXONSk1k/WJmjZm1blcayhrFiifXkBk6FuwMdMMpaqIHRWD8YH/GeNE9ce1IWi7+PatZkDWb+YF5n66yBN1ldb9Wk8kAmAAAA=";

const BASE = import.meta.env.BASE_URL ?? "/";
const APP_ICON_ADMIN  = `${BASE}icon-admin.png`;
const APP_ICON_PARENT = `${BASE}icon-parent.png`;

/** 빌드 시 고정: admin | parent | (미설정=통합 데모) */
const APP_ROLE = import.meta.env.VITE_APP_ROLE || "";
const IS_ADMIN_APP = APP_ROLE === "admin";
const IS_PARENT_APP = APP_ROLE === "parent";
const IS_SPLIT_APP = IS_ADMIN_APP || IS_PARENT_APP;

function initialAppMode() {
  if (IS_ADMIN_APP) return "login_admin";
  if (IS_PARENT_APP) return "login_parent";
  return null;
}

function loginBackMode() {
  if (IS_ADMIN_APP) return "login_admin";
  if (IS_PARENT_APP) return "login_parent";
  return null;
}

// ─── Plan System ───────────────────────────────────────────────
const MASTER_EMAIL = "admin@artmuse.kr";
const PLANS = {
  free:     { label:"Free",     color:"#8C7B72", price:0,      maxStudents:15, maxPhotosPerMonth:10 },
  standard: { label:"Standard", color:"#7A9E7E", price:37000,  maxStudents:Infinity, maxPhotosPerMonth:Infinity },
  premium:  { label:"Premium",  color:"#C9A84C", price:79000,  maxStudents:Infinity, maxPhotosPerMonth:Infinity },
};
function getEffectivePlan(userEmail, academyPlan) {
  if (userEmail === MASTER_EMAIL) return "premium";
  return academyPlan ?? "free";
}
function usePlan(userEmail, academy) {
  const plan = getEffectivePlan(userEmail, academy?.plan);
  const isMaster = userEmail === MASTER_EMAIL;
  const planInfo = PLANS[plan] ?? PLANS.free;
  const canDo = (feature) => {
    if (feature === "ai_feedback" || feature === "templates") return plan !== "free";
    if (feature === "exam_scores" || feature === "consultations") return plan === "premium";
    return true;
  };
  return { plan, planInfo, isMaster, canDo };
}
const PlanBadge = ({ plan, isMaster }) => {
  if (!plan) return null;
  const info = PLANS[plan] ?? PLANS.free;
  return (
    <span style={{fontSize:10,fontWeight:700,color:info.color,background:`${info.color}18`,padding:"2px 7px",borderRadius:10,lineHeight:1.5}}>
      {isMaster ? "🛠 Dev" : info.label}
    </span>
  );
};
const PlanGate = ({ requiredPlan, plan, onUpgrade, children, fallback }) => {
  const order = { free:0, standard:1, premium:2 };
  if ((order[plan]??0) >= (order[requiredPlan]??0)) return children;
  if (fallback) return fallback;
  return (
    <div style={{padding:16,textAlign:"center",background:"#FAF7F2",borderRadius:12,border:"1px dashed #D4CBC4"}}>
      <div style={{fontSize:20,marginBottom:8}}>{requiredPlan==="premium"?"🏆":"⭐"}</div>
      <div style={{fontSize:13,fontWeight:700,color:"#3D3530",marginBottom:4}}>
        {PLANS[requiredPlan]?.label} 플랜 전용 기능
      </div>
      <div style={{fontSize:12,color:"#8C7B72",marginBottom:12}}>
        이 기능은 {PLANS[requiredPlan]?.label} 이상 플랜에서 사용할 수 있습니다
      </div>
      <button onClick={onUpgrade} style={{padding:"8px 18px",borderRadius:20,background:"#C17F5B",color:"white",border:"none",fontSize:12,fontWeight:700,cursor:"pointer"}}>
        플랜 업그레이드 →
      </button>
    </div>
  );
};

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

async function exportJsonBackup(filename, data) {
  const json = JSON.stringify(data, null, 2);
  if (window.ArtlogNative?.exportBackup) {
    try {
      await window.ArtlogNative.exportBackup({ filename, json });
      return { ok: true, method: "native" };
    } catch (e) {
      throw new Error(e?.message || "백업 파일 내보내기에 실패했습니다.");
    }
  }
  try {
    const file = new File([json], filename, { type: "application/json" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ files: [file], title: "ArtMuse 데이터 백업" });
      return { ok: true, method: "share" };
    }
  } catch (e) {
    if (e?.name === "AbortError") return { ok: false, cancelled: true };
  }
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, method: "download" };
}

function escHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PortfolioExportBtn = ({ student, artworks, academy, feedbacks = [], style }) => {
  const [busy, setBusy] = useState(null);
  const count = artworks.filter(a => a.studentId === student.id).length;
  const handleExport = async (format) => {
    if (!count) {
      showAlert("저장할 작품이 없습니다.");
      return;
    }
    setBusy(format);
    try {
      const args = { student, artworks, academy, feedbacks };
      const r = format === "docx"
        ? await exportStudentPortfolioDocx(args)
        : await exportStudentPortfolioPdf(args);
      if (r?.cancelled) return;
      showAlert(portfolioExportSuccessMessage(r, format));
    } catch (e) {
      showAlert(e?.message || `${format === "docx" ? "Word" : "PDF"} 저장에 실패했습니다.`);
    } finally {
      setBusy(null);
    }
  };
  const btnStyle = (format) => ({
    flex: 1,
    padding: "10px 14px",
    borderRadius: 12,
    background: busy || !count ? C.light : format === "docx" ? C.white : C.beige,
    border: `1px solid ${C.sand}`,
    fontSize: 12,
    fontWeight: 700,
    cursor: busy || !count ? "not-allowed" : "pointer",
    color: C.charcoal,
  });
  return (
    <div style={{ display: "flex", gap: 8, ...style }}>
      <button onClick={() => handleExport("pdf")} disabled={!!busy || !count} style={btnStyle("pdf")}>
        {busy === "pdf" ? "PDF 생성 중…" : "📄 PDF 포트폴리오"}
      </button>
      <button onClick={() => handleExport("docx")} disabled={!!busy || !count} style={btnStyle("docx")}>
        {busy === "docx" ? "Word 생성 중…" : "📝 Word 포트폴리오"}
      </button>
    </div>
  );
};

const AttendanceExportBtn = ({ students, student, attendanceRecords, academy, style, compact = false }) => {
  const [monthKey, setMonthKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const months = recentAttendanceMonthKeys(6);
  const handleExport = async () => {
    setBusy(true);
    try {
      const r = student
        ? await exportStudentAttendanceDocx({ student, attendanceRecords, academy, monthKey })
        : await exportAttendanceRegisterDocx({ students, attendanceRecords, academy, monthKey });
      if (r?.cancelled) return;
      showAlert(attendanceExportSuccessMessage(r));
    } catch (e) {
      showAlert(e?.message || "Word 출석부 저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", ...style }}>
      <select
        value={monthKey}
        onChange={(e) => setMonthKey(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.light}`, fontSize: 13, background: C.white, color: C.charcoal, outline: "none" }}
      >
        {months.map((m) => (
          <option key={m} value={m}>{formatAttendanceMonthLabel(m)}</option>
        ))}
      </select>
      <button
        onClick={handleExport}
        disabled={busy}
        style={{
          flex: compact ? undefined : 1,
          padding: "10px 14px",
          borderRadius: 12,
          background: busy ? C.light : C.white,
          border: `1px solid ${C.sand}`,
          fontSize: 12,
          fontWeight: 700,
          cursor: busy ? "not-allowed" : "pointer",
          color: C.charcoal,
        }}
      >
        {busy ? "Word 생성 중…" : student ? "📝 Word 출석부" : "📝 Word 출석부"}
      </button>
    </div>
  );
};

const AI_FEEDBACK_SYSTEM = `당신은 실제 미술학원을 운영하며 학부모 상담과 학생 작품 피드백을 자주 작성하는 미술 선생님입니다. AI가 쓴 것처럼 보이면 안 됩니다. 실제 수업 직후 학부모에게 보내는 담백하고 자연스러운 피드백만 작성하세요.`;

function studentAgeLabel(student) {
  const g = student.grade || "";
  if (g.startsWith("유")) return `${g.replace("유", "")}세 (${g})`;
  if (g.startsWith("초")) return `${parseInt(g.slice(1), 10) + 6}세 (${g})`;
  if (g.startsWith("중")) return `${parseInt(g.slice(1), 10) + 12}세 (${g})`;
  if (g.startsWith("고")) return `${parseInt(g.slice(1), 10) + 15}세 (${g})`;
  return g || "미등록";
}

const LESSON_NOTE_FIELDS = [
  { key: "topic", label: "오늘 수업 주제", ph: "예: 봄꽃 수채화, 자화상 스케치" },
  { key: "materials", label: "사용 재료", ph: "예: 수채 물감, 4B 연필" },
  { key: "features", label: "작품 특징", ph: "예: 배경까지 채움, 색 여러 번 덧칠" },
  { key: "good", label: "잘한 점", ph: "예: 형태 집중, 스스로 수정" },
  { key: "hard", label: "어려워한 점", ph: "예: 명암 경계, 비율" },
  { key: "attitude", label: "수업 태도", ph: "예: 끝까지 집중, 질문 많음" },
];

function buildAIFeedbackPrompt(student, artwork, lessonNotes = {}) {
  const ageLabel = studentAgeLabel(student);
  let contextBlock = "";
  if (artwork) {
    contextBlock = `[선택 작품]
- 작품명: ${artwork.title} (${artwork.medium ?? ""})
- 작품 설명: ${artwork.desc ?? "없음"}
- 진행률: ${artwork.progress ?? 0}%`;
    const noteLines = LESSON_NOTE_FIELDS
      .map(({ key, label }) => lessonNotes[key]?.trim() ? `- ${label}: ${lessonNotes[key].trim()}` : null)
      .filter(Boolean);
    if (noteLines.length) {
      contextBlock += `\n\n[원장 추가 메모]\n${noteLines.join("\n")}`;
    }
  } else {
    const noteLines = LESSON_NOTE_FIELDS
      .map(({ key, label }) => lessonNotes[key]?.trim() ? `- ${label}: ${lessonNotes[key].trim()}` : null)
      .filter(Boolean);
    contextBlock = noteLines.length
      ? `[원장이 입력한 수업 메모]\n${noteLines.join("\n")}`
      : `[작품 미선택 · 수업 메모 없음]\n학생 성향과 일반적인 수업 흐름을 바탕으로 작성하되, 구체적 장면은 지어내지 마세요.`;
  }

  return `학부모에게 전달되는 ${student.name}(${ageLabel}) 학생의 작품 피드백을 작성하세요.

[학생 정보]
- 이름: ${student.name}
- 나이·학년: ${ageLabel}
- 학교: ${student.school ?? ""}
- 성향: ${student.tags.join(", ") || "꾸준히 수업에 참여"}
${student.memo ? `- 선생님 메모: ${student.memo}` : ""}

${contextBlock}

[중요]
AI가 작성한 느낌이 나지 않아야 합니다.

따라서 아래 특징을 반드시 지키세요.

* 실제 미술 선생님이 수업 후 학부모에게 보내는 자연스러운 말투 사용
* 과하게 완벽하거나 정돈된 문장 금지
* 모든 문장을 칭찬으로만 채우지 말 것
* 학생마다 관찰 포인트를 다르게 작성
* 실제 수업을 본 사람처럼 구체적으로 작성
* 결과뿐 아니라 작업 과정과 태도도 언급
* 억지 감동 표현, 과한 리액션 금지
* 같은 표현 반복 금지
* "너무 잘했어요", "최고예요" 같은 과장 표현 최소화
* 자연스럽고 담백한 학원 피드백 느낌 유지

[피드백 구성]
반드시 아래 흐름을 자연스럽게 포함:

1. 오늘 진행한 수업/주제
2. 학생이 집중해서 작업한 부분
3. 잘된 표현 또는 성장한 부분
4. 어려워했던 부분 또는 보완점
5. 다음 수업에서 기대되는 점
6. 마무리 총평

[문체 규칙]

* 문장은 총 5~6문장
* 학부모가 읽기에 부드럽고 신뢰감 있는 톤
* 문장 길이를 조금씩 다르게 작성
* 너무 모범답안처럼 쓰지 말 것
* 실제 사람이 즉석에서 작성한 느낌 유지
* 학생마다 어휘와 문장 흐름을 조금씩 다르게 할 것

[좋은 표현 예시]

* 오늘은 형태를 끝까지 집중해서 잡아보려고 했어요.
* 색을 여러 번 덧입히면서 표현이 훨씬 자연스러워졌습니다.
* 중간에 어려워하는 부분도 있었지만 스스로 수정해보려는 모습이 좋았어요.
* 배경까지 신경 쓰면서 화면 구성이 안정적으로 정리됐습니다.
* 관찰하면서 표현하려는 태도가 점점 좋아지고 있어요.
* 다음 시간에는 명암 표현을 조금 더 깊게 연습해보면 좋겠습니다.

[출력 형식]
불필요한 제목 없이 바로 피드백만 작성하세요.`;
}

async function fetchOpenAIChat(prompt) {
  const model = import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini";
  const useProxy = import.meta.env.DEV;
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!useProxy && !apiKey) {
    throw new Error(
      "OpenAI API 키가 설정되지 않았습니다. 프로젝트 루트 .env에 VITE_OPENAI_API_KEY를 추가해 주세요."
    );
  }

  const url = useProxy
    ? "/api/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(useProxy ? {} : { Authorization: `Bearer ${apiKey}` }),
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: AI_FEEDBACK_SYSTEM,
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1500,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (useProxy && res.status === 404) {
      throw new Error(
        "개발 서버에 OpenAI 프록시가 없습니다. 루트 .env에 VITE_OPENAI_API_KEY를 넣고 npm run dev 를 다시 실행하세요."
      );
    }
    throw new Error(data.error?.message || `OpenAI API 오류 (${res.status})`);
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("응답을 생성하지 못했습니다.");
  return text;
}

async function requestAIFeedback(student, artwork, lessonNotes) {
  const prompt = buildAIFeedbackPrompt(student, artwork, lessonNotes);

  if (window.ArtlogNative?.generateFeedback) {
    try {
      const data = await window.ArtlogNative.generateFeedback({ prompt });
      return typeof data === "string" ? data : data?.text;
    } catch (err) {
      if (import.meta.env.VITE_OPENAI_API_KEY) {
        return fetchOpenAIChat(prompt);
      }
      throw err;
    }
  }

  return fetchOpenAIChat(prompt);
}

// ─── Data ──────────────────────────────────────────────────
const STUDENTS = [
  { id:"1", name:"김서아",  school:"한별초",  grade:"초4", classDay:["MON","WED"],       classTime:"15:00", tags:["집중력좋음","색감감각"], status:"present", fee:"납부완료",   art:"🌸", artCount:12, phone:"010-1111-1111", parentPhone:"010-1234-5678", enroll:"2024-03-02", monthlyFee:150000, feeDueDay:5,  memo:"색감 감각이 뛰어나며 집중력이 좋음. 수채화를 특히 좋아함." },
  { id:"2", name:"박지호",  school:"햇살초",  grade:"초6", classDay:["TUE","THU"],       classTime:"14:00", tags:["소극적","성실"],         status:"absent",  fee:"미납",      art:"🦋", artCount:8,  phone:"010-2222-2222", parentPhone:"010-2345-6789", enroll:"2024-05-10", monthlyFee:150000, feeDueDay:5,  memo:"소극적이지만 꾸준히 발전하는 학생." },
  { id:"3", name:"이나연",  school:"푸른중",  grade:"중1", classDay:["MON","WED","FRI"], classTime:"16:00", tags:["창의력높음"],             status:"late",    fee:"납부완료",   art:"🌊", artCount:21, phone:"010-3333-3333", parentPhone:"010-3456-7890", enroll:"2023-09-01", monthlyFee:170000, feeDueDay:1,  memo:"창의력이 매우 높고 표현력이 풍부함." },
  { id:"4", name:"최민준",  school:"별빛초",  grade:"초5", classDay:["TUE","FRI"],       classTime:"15:00", tags:["꼼꼼함"],                status:null,      fee:"예정(3일후)",art:"🏔️",artCount:6,  phone:"010-4444-4444", parentPhone:"010-4567-8901", enroll:"2025-01-15", monthlyFee:150000, feeDueDay:29, memo:"꼼꼼한 성격으로 디테일을 잘 잡음." },
  { id:"5", name:"한소율",  school:"무지개초",grade:"초3", classDay:["WED","FRI"],       classTime:"14:00", tags:["활발함","색감감각"],      status:"present", fee:"납부완료",   art:"🌻", artCount:15, phone:"010-5555-5555", parentPhone:"010-5678-9012", enroll:"2024-01-08", monthlyFee:130000, feeDueDay:5,  memo:"활발하고 에너지 넘치는 학생. 색감 본능이 있음." },
  { id:"6", name:"윤지원",  school:"한별중",  grade:"중2", classDay:["MON","THU"],       classTime:"17:00", tags:["디테일강함"],             status:null,      fee:"미납",      art:"🎭", artCount:18, phone:"010-6666-6666", parentPhone:"010-6789-0123", enroll:"2023-03-02", monthlyFee:170000, feeDueDay:5,  memo:"디테일이 강하고 완성도에 대한 욕심이 있음." },
  { id:"7", name:"정하은",  school:"강남고",  grade:"고2", classDay:["TUE","THU"],       classTime:"17:00", tags:["표현력뛰어남"],           status:null,      fee:"납부완료",   art:"🎨", artCount:9,  phone:"010-7777-7777", parentPhone:"010-7890-1234", enroll:"2024-09-01", monthlyFee:200000, feeDueDay:5,  memo:"고등부 수준의 완성도를 보여주는 학생." },
];

const LINKED_PARENTS_INIT = [
  { id:'p1', name:'김미영', phone:'010-1234-5678', studentId:'1', studentName:'김서아', studentArt:'🌸', joinedAt:'2024-03-05', fcm:true  },
  { id:'p2', name:'이준호', phone:'010-3456-7890', studentId:'3', studentName:'이나연', studentArt:'🌊', joinedAt:'2024-01-20', fcm:true  },
  { id:'p3', name:'한명수', phone:'010-5678-9012', studentId:'5', studentName:'한소율', studentArt:'🌻', joinedAt:'2024-01-15', fcm:false },
];

const INVITES_INIT = [
  { id:'i1', code:'ARTM-7K2P', studentId:'2', studentName:'박지호', studentArt:'🦋', createdAt:'2025-05-24', expiresAt:'2025-05-31', used:false },
  { id:'i2', code:'ARTM-9XQ1', studentId:'4', studentName:'최민준', studentArt:'🏔️', createdAt:'2025-05-20', expiresAt:'2025-05-27', used:false },
];

function loadInvites() {
  try {
    const raw = localStorage.getItem("artlog_invites");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return INVITES_INIT;
}

function saveInvites(list) {
  try {
    localStorage.setItem("artlog_invites", JSON.stringify(list));
  } catch { /* ignore */ }
}

function loadParentSession() {
  try {
    const raw = localStorage.getItem("artlog_parent_session");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveParentSession(session) {
  try {
    if (session) localStorage.setItem("artlog_parent_session", JSON.stringify(session));
    else localStorage.removeItem("artlog_parent_session");
  } catch { /* ignore */ }
}

const ACADEMY_DEFAULTS = {
  name: "아트뮤즈",
  tagline: "꿈을 향한 날개짓, 여기서 시작하세요",
  phone: "010-1234-5678",
  addr: "서울시 마포구 합정동 123-4",
  logoUrl: null,
  email: "admin@artmuse.kr",
  bankName: "",
  bankAccount: "",
  notifs: {
    attendPush: true,
    feedbackPush: true,
    paymentRemind: true,
    noticePush: true,
  },
};

function loadAcademySettings() {
  try {
    const raw = localStorage.getItem("artlog_academy");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...ACADEMY_DEFAULTS, ...parsed, notifs: { ...ACADEMY_DEFAULTS.notifs, ...parsed.notifs } };
    }
  } catch { /* ignore */ }
  return { ...ACADEMY_DEFAULTS, notifs: { ...ACADEMY_DEFAULTS.notifs } };
}

function saveAcademySettings(settings) {
  try {
    localStorage.setItem("artlog_academy", JSON.stringify(settings));
  } catch { /* ignore */ }
}

function resolveLogoUrl(logoUrl) {
  return logoUrl || LOGO;
}

// ─── Push Notification ────────────────────────────────────────
async function savePushToken(userId, token) {
  if (!token || !userId) return;
  try {
    const sb = requireSupabase();
    await sb.from("profiles").update({ push_token: token }).eq("id", userId);
    await sb.from("parent_student_links").update({ push_token: token }).eq("parent_user_id", userId);
  } catch { /* silent */ }
}

async function sendPushToParents({ academyId, studentIds, title, body, data }) {
  try {
    const sb = requireSupabase();
    let query = sb.from("parent_student_links").select("push_token").eq("academy_id", academyId).not("push_token", "is", null);
    if (studentIds?.length) query = query.in("student_id", studentIds);
    const { data: rows } = await query;
    const tokens = [...new Set((rows ?? []).map(r => r.push_token).filter(Boolean))];
    if (!tokens.length) return;
    await sb.functions.invoke("push-notify", { body: { tokens, title, body, data } });
  } catch { /* silent */ }
}

function isInviteExpired(invite) {
  return new Date(`${invite.expiresAt}T23:59:59`) < new Date();
}

const ARTWORKS_INIT = [
  { id:"a1", studentId:"1", studentName:"김서아", title:"봄꽃 수채화",   medium:"수채화",  date:"2025-05-20", emoji:"🌸", progress:100, desc:"꽃잎의 그라데이션을 섬세하게 표현한 작품입니다." },
  { id:"a2", studentId:"3", studentName:"이나연", title:"바다 풍경",     medium:"아크릴",  date:"2025-05-19", emoji:"🌊", progress:85,  desc:"원근감 있는 바다 풍경화입니다." },
  { id:"a3", studentId:"5", studentName:"한소율", title:"해바라기밭",    medium:"크레파스",date:"2025-05-18", emoji:"🌻", progress:100, desc:"밝고 생동감 넘치는 해바라기 연작입니다." },
  { id:"a4", studentId:"2", studentName:"박지호", title:"나비 연구",     medium:"색연필",  date:"2025-05-17", emoji:"🦋", progress:70,  desc:"나비의 날개 패턴을 세밀하게 관찰한 작품입니다." },
  { id:"a5", studentId:"6", studentName:"윤지원", title:"도시의 밤",     medium:"수채화",  date:"2025-05-16", emoji:"🎭", progress:100, desc:"도시의 야경을 명암 대비로 표현했습니다." },
  { id:"a6", studentId:"4", studentName:"최민준", title:"산악 스케치",   medium:"연필",    date:"2025-05-15", emoji:"🏔️",progress:60,  desc:"산의 능선을 연필로 스케치한 습작입니다." },
  { id:"a7", studentId:"1", studentName:"김서아", title:"정물화",        medium:"수채화",  date:"2025-04-28", emoji:"🍎", progress:100, desc:"사과와 꽃병이 있는 정물화입니다." },
  { id:"a8", studentId:"1", studentName:"김서아", title:"자화상 스케치", medium:"연필",    date:"2025-04-10", emoji:"🧍", progress:100, desc:"거울을 보며 그린 자화상 연필 스케치입니다." },
  { id:"a9", studentId:"3", studentName:"이나연", title:"봄날의 공원",   medium:"수채화",  date:"2025-04-22", emoji:"🌳", progress:100, desc:"봄날 공원의 싱그러운 풍경입니다." },
  { id:"a10",studentId:"5", studentName:"한소율", title:"무지개 물고기", medium:"크레파스",date:"2025-04-15", emoji:"🐠", progress:100, desc:"다양한 색으로 표현한 물고기 작품입니다." },
];

function loadArtworks() {
  try {
    const raw = localStorage.getItem("artlog_artworks");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return ARTWORKS_INIT;
}

function saveArtworks(list) {
  try {
    localStorage.setItem("artlog_artworks", JSON.stringify(list));
  } catch { /* ignore */ }
}

const FEEDBACKS_DATA = [
  { id:"f1",studentName:"김서아",content:"오늘 수업에서 색감 표현이 매우 풍부해졌어요! 특히 꽃잎의 그라데이션 표현이 정말 아름답습니다 🌸",        date:"2025-05-20",read:true, artwork:"봄꽃 수채화",  artEmoji:"🌸" },
  { id:"f2",studentName:"김서아",content:"정물화 작품에서 빛과 그림자를 표현하는 방법이 한층 성장했습니다. 사과의 둥근 형태감이 잘 살아있어요 👍",   date:"2025-04-28",read:true, artwork:"정물화",       artEmoji:"🍎" },
  { id:"f3",studentName:"이나연",content:"바다 풍경 그림에서 원근감이 잘 표현되었습니다. 수평선의 색감 처리가 특히 좋았어요! 아크릴 물감 다루는 솜씨가 늘었습니다.", date:"2025-05-19",read:false,artwork:"바다 풍경",   artEmoji:"🌊" },
  { id:"f4",studentName:"박지호",content:"나비 연구 작품에서 형태 관찰력이 향상되고 있습니다. 꾸준히 노력하는 모습이 보여서 기특합니다 💪",          date:"2025-05-17",read:true, artwork:"나비 연구",   artEmoji:"🦋" },
];

const SCHEDULES_INIT = [
  { id:"sc1",date:"2025-05-26",type:"class",  title:"정규 수업",     time:"15:00",studentName:null },
  { id:"sc2",date:"2025-05-28",type:"class",  title:"정규 수업",     time:"15:00",studentName:null },
  { id:"sc3",date:"2025-05-29",type:"makeup", title:"박지호 보강",   time:"14:00",studentName:"박지호" },
  { id:"sc5",date:"2025-06-05",type:"event",  title:"봄 작품 전시회",time:"13:00",studentName:null },
  { id:"sc6",date:"2025-06-09",type:"makeup", title:"이나연 보강",   time:"16:00",studentName:"이나연" },
];

// 한국 공휴일 · 대체공휴일 (연도별 — 달력 자동 등록용)
const KOREAN_HOLIDAYS = [
  // 2025
  {date:"2025-01-01",title:"신정",substitute:false},
  {date:"2025-01-28",title:"설날 연휴",substitute:false},
  {date:"2025-01-29",title:"설날",substitute:false},
  {date:"2025-01-30",title:"설날 연휴",substitute:false},
  {date:"2025-03-01",title:"삼일절",substitute:false},
  {date:"2025-03-03",title:"삼일절",substitute:true},
  {date:"2025-05-05",title:"어린이날·석가탄신일",substitute:false},
  {date:"2025-06-06",title:"현충일",substitute:false},
  {date:"2025-08-15",title:"광복절",substitute:false},
  {date:"2025-10-03",title:"개천절",substitute:false},
  {date:"2025-10-05",title:"추석 연휴",substitute:false},
  {date:"2025-10-06",title:"추석",substitute:false},
  {date:"2025-10-07",title:"추석 연휴",substitute:false},
  {date:"2025-10-08",title:"추석·개천절",substitute:true},
  {date:"2025-10-09",title:"한글날",substitute:false},
  {date:"2025-12-25",title:"성탄절",substitute:false},
  // 2026
  {date:"2026-01-01",title:"신정",substitute:false},
  {date:"2026-02-16",title:"설날 연휴",substitute:false},
  {date:"2026-02-17",title:"설날",substitute:false},
  {date:"2026-02-18",title:"설날 연휴",substitute:false},
  {date:"2026-03-01",title:"삼일절",substitute:false},
  {date:"2026-03-02",title:"삼일절",substitute:true},
  {date:"2026-05-05",title:"어린이날",substitute:false},
  {date:"2026-05-24",title:"석가탄신일",substitute:false},
  {date:"2026-06-06",title:"현충일",substitute:false},
  {date:"2026-06-08",title:"현충일",substitute:true},
  {date:"2026-08-15",title:"광복절",substitute:false},
  {date:"2026-08-17",title:"광복절",substitute:true},
  {date:"2026-09-24",title:"추석 연휴",substitute:false},
  {date:"2026-09-25",title:"추석",substitute:false},
  {date:"2026-09-26",title:"추석 연휴",substitute:false},
  {date:"2026-10-03",title:"개천절",substitute:false},
  {date:"2026-10-05",title:"개천절",substitute:true},
  {date:"2026-10-09",title:"한글날",substitute:false},
  {date:"2026-12-25",title:"성탄절",substitute:false},
  // 2024
  {date:"2024-01-01",title:"신정",substitute:false},
  {date:"2024-02-09",title:"설날 연휴",substitute:false},
  {date:"2024-02-10",title:"설날",substitute:false},
  {date:"2024-02-11",title:"설날 연휴",substitute:false},
  {date:"2024-02-12",title:"설날",substitute:true},
  {date:"2024-03-01",title:"삼일절",substitute:false},
  {date:"2024-04-10",title:"국회의원선거",substitute:false},
  {date:"2024-05-05",title:"어린이날",substitute:false},
  {date:"2024-05-06",title:"어린이날",substitute:true},
  {date:"2024-05-15",title:"석가탄신일",substitute:false},
  {date:"2024-06-06",title:"현충일",substitute:false},
  {date:"2024-08-15",title:"광복절",substitute:false},
  {date:"2024-09-16",title:"추석 연휴",substitute:false},
  {date:"2024-09-17",title:"추석",substitute:false},
  {date:"2024-09-18",title:"추석 연휴",substitute:false},
  {date:"2024-10-03",title:"개천절",substitute:false},
  {date:"2024-10-09",title:"한글날",substitute:false},
  {date:"2024-12-25",title:"성탄절",substitute:false},
  // 2027
  {date:"2027-01-01",title:"신정",substitute:false},
  {date:"2027-02-06",title:"설날 연휴",substitute:false},
  {date:"2027-02-07",title:"설날",substitute:false},
  {date:"2027-02-08",title:"설날 연휴",substitute:false},
  {date:"2027-02-09",title:"설날",substitute:true},
  {date:"2027-03-01",title:"삼일절",substitute:false},
  {date:"2027-05-05",title:"어린이날",substitute:false},
  {date:"2027-05-13",title:"석가탄신일",substitute:false},
  {date:"2027-06-06",title:"현충일",substitute:false},
  {date:"2027-08-15",title:"광복절",substitute:false},
  {date:"2027-08-16",title:"광복절",substitute:true},
  {date:"2027-09-14",title:"추석 연휴",substitute:false},
  {date:"2027-09-15",title:"추석",substitute:false},
  {date:"2027-09-16",title:"추석 연휴",substitute:false},
  {date:"2027-10-03",title:"개천절",substitute:false},
  {date:"2027-10-04",title:"개천절",substitute:true},
  {date:"2027-10-09",title:"한글날",substitute:false},
  {date:"2027-10-11",title:"한글날",substitute:true},
  {date:"2027-12-25",title:"성탄절",substitute:false},
  {date:"2027-12-27",title:"성탄절",substitute:true},
];

const NOTICES_INIT = [
  { id:"n1",title:"6월 수업료 안내",         content:"6월 수업료는 6월 1일까지 납부 부탁드립니다. 계좌: 국민은행 123-456-789012 (아트뮤즈)",                                          date:"2025-05-24",important:true  },
  { id:"n2",title:"봄 작품 전시회 안내",     content:"6월 5일(목) 오후 1시부터 3시까지 아트뮤즈 갤러리에서 봄 작품 전시회가 열립니다. 많은 참여 바랍니다 🎨",                          date:"2025-05-20",important:false },
  { id:"n3",title:"현충일 휴원 안내",        content:"6월 6일(금) 현충일은 휴원합니다. 해당 날 수업은 개별 연락 드린 일정으로 보강 예정입니다.",                                        date:"2025-05-18",important:false },
];

const REVENUE_DATA = [
  {m:"1월",v:820000},{m:"2월",v:750000},{m:"3월",v:900000},
  {m:"4월",v:870000},{m:"5월",v:720000},{m:"6월",v:0},
];
const ATTEND_WEEK = [
  {day:"월",present:4,total:4},{day:"화",present:3,total:3},
  {day:"수",present:4,total:5},{day:"목",present:2,total:3},{day:"금",present:3,total:4},
];
const CLASS_TIMES = ["14:00", "15:00", "16:00", "17:00"];
const ACADEMY_OPTIONS_DEFAULTS = {
  classTimes: [...CLASS_TIMES],
  monthlyFees: [100000, 120000, 130000, 150000, 170000, 200000],
  feeDueDays: [1, 5, 10, 15, 20, 25],
};

function loadAcademyOptions() {
  try {
    const raw = localStorage.getItem("artlog_academy_options");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        classTimes: parsed.classTimes?.length ? parsed.classTimes : [...ACADEMY_OPTIONS_DEFAULTS.classTimes],
        monthlyFees: parsed.monthlyFees?.length ? parsed.monthlyFees : [...ACADEMY_OPTIONS_DEFAULTS.monthlyFees],
        feeDueDays: parsed.feeDueDays?.length ? parsed.feeDueDays : [...ACADEMY_OPTIONS_DEFAULTS.feeDueDays],
      };
    }
  } catch { /* ignore */ }
  return {
    classTimes: [...ACADEMY_OPTIONS_DEFAULTS.classTimes],
    monthlyFees: [...ACADEMY_OPTIONS_DEFAULTS.monthlyFees],
    feeDueDays: [...ACADEMY_OPTIONS_DEFAULTS.feeDueDays],
  };
}

function saveAcademyOptions(options) {
  try {
    localStorage.setItem("artlog_academy_options", JSON.stringify(options));
  } catch { /* ignore */ }
}

const DEPTS = [{id:"all",l:"전체"},{id:"kindergarten",l:"유치부"},{id:"elem",l:"초등부"},{id:"middle",l:"중등부"},{id:"high",l:"고등부"}];
const DOW_FROM_DATE = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

// ─── Helpers ───────────────────────────────────────────────
const dayName  = d => ({MON:"월",TUE:"화",WED:"수",THU:"목",FRI:"금"}[d]??d);
const getDept  = g => g.startsWith("유")?"kindergarten":g.startsWith("초")?"elem":g.startsWith("중")?"middle":"high";
const deptLabel= d => ({all:"전체",kindergarten:"유치부",elem:"초등부",middle:"중등부",high:"고등부"}[d]??d);
const attendKey= (id,t) => `${id}:${t}`;

function feedbacksForStudent(feedbacks, student) {
  if (!student?.id) return [];
  return (feedbacks ?? []).filter(
    (f) =>
      String(f.studentId) === String(student.id) ||
      (!f.studentId && f.studentName === student.name)
  );
}

function todayDowCode(date = new Date()) {
  return DOW_FROM_DATE[date.getDay()];
}

function formatKoreanDate(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dow = DOW_KO[date.getDay()];
  return `${y}년 ${m}월 ${d}일 ${dow}요일`;
}

function recentMonthKeys(count = 3, date = new Date()) {
  const months = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(date.getFullYear(), date.getMonth() - i, 1);
    months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function formatMonthTabLabel(monthKey) {
  const [, m] = monthKey.split("-");
  return `${Number(m)}월`;
}

const getAttendStatus = (map,s,t) => map[attendKey(s.id,t)]??((s.classDay??[]).includes(todayDowCode())?s.status:null);

function currentMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function studentAttendanceSummary(studentId, records, monthKey = currentMonthKey()) {
  const rows = (records ?? []).filter(
    (r) => r.student_id === studentId && String(r.attendance_date ?? "").startsWith(monthKey)
  );
  const counts = { present: 0, late: 0, absent: 0 };
  for (const r of rows) {
    if (r.status === "present") counts.present++;
    else if (r.status === "late") counts.late++;
    else if (r.status === "absent") counts.absent++;
  }
  const total = counts.present + counts.late + counts.absent;
  const rate = total > 0 ? Math.round((counts.present / total) * 100) : 0;
  return {
    ...counts,
    total,
    rate,
    rows: [...rows].sort((a, b) => String(b.attendance_date).localeCompare(String(a.attendance_date))),
  };
}

function formatAttendanceCheckIn(checkedAt, attendanceDate, classTime) {
  const base = checkedAt ? new Date(checkedAt) : new Date(`${attendanceDate}T${classTime || "12:00"}:00`);
  if (Number.isNaN(base.getTime())) return "";
  const y = base.getFullYear();
  const m = base.getMonth() + 1;
  const d = base.getDate();
  const hh = String(base.getHours()).padStart(2, "0");
  const mm = String(base.getMinutes()).padStart(2, "0");
  return `${y}년 ${m}월 ${d}일 ${hh}:${mm} 체크인`;
}

function studentTodayAttendance(studentId, records, classTime) {
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = (records ?? []).filter(
    (r) => r.student_id === studentId && String(r.attendance_date ?? "").slice(0, 10) === today
  );
  if (!todayRows.length) return null;
  return todayRows.find((r) => r.class_time === classTime) ?? todayRows[0];
}

function formatAttendanceHistoryRow(r) {
  const d = new Date(`${r.attendance_date}T12:00:00`);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const md = `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}`;
  const label = { present: "출석", late: "지각", absent: "결석" }[r.status] ?? r.status;
  return {
    key: r.id ?? `${r.attendance_date}-${r.class_time}-${r.status}`,
    text: `${md} ${days[d.getDay()]} ${label}`,
    status: r.status,
  };
}
const typeColor= t => ({
  class:  {bg:"#EEF4FF",c:C.blue},
  makeup: {bg:"#E8F4EA",c:C.sage},
  closure:{bg:"#FDEAEA",c:C.red},
  holiday:{bg:"#FFF0F0",c:"#C0392B"},
  event:  {bg:"#FDF5E0",c:C.gold},
  payment:{bg:"#FFF0E6",c:C.terra},
}[t]??{bg:C.beige,c:C.warm});
const typeLabel= t => ({class:"정규",makeup:"보강",closure:"휴원",holiday:"공휴일",event:"행사",payment:"수강료"}[t]??t);
const fmtMoney = v => v.toLocaleString()+"원";

function buildWeeklyAttendance(students, records) {
  const codes = ["MON", "TUE", "WED", "THU", "FRI"];
  const labels = ["월", "화", "수", "목", "금"];
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  return codes.map((code, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = date.toISOString().slice(0, 10);
    const scheduled = (students ?? []).filter((s) => s.classDay?.includes(code));
    const total = scheduled.length;
    const present = (records ?? []).filter(
      (r) =>
        String(r.attendance_date ?? "").slice(0, 10) === dateStr &&
        scheduled.some((s) => s.id === r.student_id) &&
        (r.status === "present" || r.status === "late")
    ).length;
    return { day: labels[i], present, total };
  });
}

function buildGrowthPairs(students, artworks) {
  const pairs = [];
  for (const student of students ?? []) {
    const arts = (artworks ?? [])
      .filter((a) => a.studentId === student.id)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    if (arts.length < 2) continue;
    const before = arts[0];
    const after = arts[arts.length - 1];
    const ms = new Date(after.date) - new Date(before.date);
    const days = Number.isFinite(ms) ? Math.max(Math.round(ms / 86400000), 0) : 0;
    pairs.push({
      id: student.id,
      studentName: student.name,
      beforeEmoji: before.emoji,
      afterEmoji: after.emoji,
      beforePhotoUri: before.photoUri,
      afterPhotoUri: after.photoUri,
      beforeTitle: before.title,
      afterTitle: after.title,
      beforeDate: before.date,
      afterDate: after.date,
      growth: days > 0 ? `${days}일 · 작품 ${arts.length}점` : `작품 ${arts.length}점`,
      timelineArts: arts,
    });
  }
  return pairs;
}

const DOW_CODES = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

function paymentDueDay(year, month, feeDueDay) {
  const last = new Date(year, month, 0).getDate();
  return Math.min(feeDueDay, last);
}

function dowCode(year, month, day) {
  return DOW_CODES[new Date(year, month - 1, day).getDay()];
}

const ArtworkCover = ({ artwork, height = 120, fontSize = 48 }) =>
  artwork.photoUri ? (
    <img src={artwork.photoUri} alt={artwork.title} style={{ width: "100%", height, objectFit: "cover", display: "block" }} />
  ) : (
    <div style={{ background: `linear-gradient(135deg,${C.beige},${C.sand})`, display: "flex", alignItems: "center", justifyContent: "center", minHeight: height, fontSize }}>{artwork.emoji}</div>
  );

const ArtworkThumb = ({ artwork, size = 88, selected = null, onClick, showLabel = true }) => {
  const active = selected === null ? true : selected;
  return (
    <div
      onClick={onClick}
      style={{ flexShrink: 0, width: size, cursor: onClick ? "pointer" : "default", opacity: active ? 1 : 0.55 }}
    >
      <div style={{
        aspectRatio: "1", borderRadius: 10, overflow: "hidden",
        border: `2px solid ${selected ? C.terra : C.light}`,
        marginBottom: showLabel ? 4 : 0,
        background: C.beige,
      }}
      >
        {artwork.photoUri ? (
          <img src={artwork.photoUri} alt={artwork.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: Math.round(size * 0.36), background: `linear-gradient(135deg,${C.beige},${C.sand})`,
          }}
          >
            {artwork.emoji}
          </div>
        )}
      </div>
      {showLabel && (
        <div style={{
          fontSize: 10, fontWeight: 600, color: selected ? C.terra : C.charcoal, textAlign: "center",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
        >
          {artwork.title}
        </div>
      )}
    </div>
  );
};

const StudentAvatar = ({ student, size = 44, fontSize = null, style = {} }) => {
  const fs = fontSize ?? Math.round(size * 0.55);
  if (shouldShowStudentEmoji(student)) {
    return (
      <div style={{
        width: size, height: size, borderRadius: size / 2,
        background: `linear-gradient(135deg,${C.beige},${C.sand})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: fs, flexShrink: 0, ...style,
      }}
      >
        {student?.art ?? "🎨"}
      </div>
    );
  }
  return (
    <img
      src={getStudentAvatarSrc(student)}
      alt={student?.name ?? "학생"}
      style={{ width: size, height: size, borderRadius: size / 2, objectFit: "cover", flexShrink: 0, ...style }}
    />
  );
};

const holidayScheduleTitle = h => h.substitute ? `${h.title} (대체공휴일)` : h.title;
const holidayToSchedule = h => ({
  id:`hol-${h.date}`,
  date:h.date,
  type:"holiday",
  title:holidayScheduleTitle(h),
  time:null,
  studentName:null,
  autoHoliday:true,
  substitute:h.substitute,
});
const mergeHolidaySchedules = (schedules, years=[2024,2025,2026,2027]) => {
  const ids = new Set(schedules.map(s=>s.id));
  const added = [];
  years.forEach(y=>{
    KOREAN_HOLIDAYS.filter(h=>h.date.startsWith(String(y))).forEach(h=>{
      const sch = holidayToSchedule(h);
      if(!ids.has(sch.id)){ ids.add(sch.id); added.push(sch); }
    });
  });
  return [...schedules, ...added];
};
const getHolidayForDate = date => KOREAN_HOLIDAYS.find(h=>h.date===date);
const timeToMinutes = t => { const [h,m]=t.split(":").map(Number); return h*60+m; };
const fmtMins = mins => `${String(Math.floor(mins/60)).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}`;
const ATTEND_WINDOW_BEFORE = 30;
const ATTEND_WINDOW_AFTER = 30;
const getActiveClassTime = (nowMins, times = CLASS_TIMES) => {
  for (const t of times) {
    const start = timeToMinutes(t) - ATTEND_WINDOW_BEFORE;
    const end = timeToMinutes(t) + ATTEND_WINDOW_AFTER;
    if (nowMins >= start && nowMins <= end) return t;
  }
  return null;
};
const classWindowLabel = time => {
  const start = timeToMinutes(time) - ATTEND_WINDOW_BEFORE;
  const end = timeToMinutes(time) + ATTEND_WINDOW_AFTER;
  return `${fmtMins(start)} ~ ${fmtMins(end)}`;
};

// ─── UI Atoms ──────────────────────────────────────────────
const Badge=({children,color="beige",small=false})=>{
  const m={beige:{bg:C.beige,c:C.charcoal},green:{bg:"#E8F4EA",c:C.sage},red:{bg:"#FDEAEA",c:C.red},gold:{bg:"#FDF5E0",c:C.gold},blue:{bg:"#E8EFF5",c:C.blue},terra:{bg:"#F5EDE6",c:C.terra},purple:{bg:"#F0EDF8",c:C.purple}};
  const{bg,c}=m[color]??m.beige;
  return <span style={{display:"inline-flex",alignItems:"center",padding:small?"2px 8px":"3px 10px",borderRadius:20,fontSize:small?10:11,fontWeight:600,background:bg,color:c}}>{children}</span>;
};
const StatusChip=({s})=>{
  const m={present:{l:"출석",c:"green"},late:{l:"지각",c:"gold"},absent:{l:"결석",c:"red"},makeup:{l:"보강",c:"blue"}};
  if(!s)return null;
  const{l,c}=m[s]??{};
  return <Badge color={c} small>{l}</Badge>;
};
const Card=({children,style={},onClick})=>(
  <div onClick={onClick} style={{background:C.white,borderRadius:16,padding:16,boxShadow:"0 2px 12px rgba(61,53,48,0.07)",cursor:onClick?"pointer":"default",transition:"transform .15s,box-shadow .15s",...style}}
    onMouseEnter={e=>onClick&&(e.currentTarget.style.transform="translateY(-2px)",e.currentTarget.style.boxShadow="0 6px 20px rgba(61,53,48,0.12)")}
    onMouseLeave={e=>(e.currentTarget.style.transform="",e.currentTarget.style.boxShadow="0 2px 12px rgba(61,53,48,0.07)")}
  >{children}</div>
);
const SecTitle=({children,action,onAction})=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
    <span style={{fontSize:14,fontWeight:700,color:C.charcoal,letterSpacing:"0.03em"}}>{children}</span>
    {action&&<span onClick={onAction} style={{fontSize:12,color:C.terra,fontWeight:600,cursor:"pointer"}}>{action}</span>}
  </div>
);
const Logo=({w=80,src})=><img src={src||LOGO} alt="아트뮤즈" style={{width:w,height:"auto",objectFit:"contain",display:"block"}}/>;
const ProgressBar=({value,color=C.sage,h=4})=>(
  <div style={{height:h,background:C.beige,borderRadius:h/2}}>
    <div style={{height:"100%",borderRadius:h/2,background:color,width:`${Math.min(value,100)}%`,transition:"width .6s"}}/>
  </div>
);
const AppAlertModal=({message,onClose})=>{
  if(!message)return null;
  // 줄바꿈 처리
  const lines=String(message).split("\n");
  return(
    <div
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:"0 24px"}}
      onClick={onClose}
    >
      <div
        onClick={e=>e.stopPropagation()}
        style={{background:C.white,borderRadius:16,width:"100%",maxWidth:360,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",overflow:"hidden"}}
      >
        {/* 제목 */}
        <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${C.beige}`,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>🔔</span>
          <span style={{fontSize:15,fontWeight:700,color:C.charcoal}}>앱 알림</span>
        </div>
        {/* 내용 */}
        <div style={{padding:"16px 20px 20px"}}>
          {lines.map((line,i)=>(
            <p key={i} style={{fontSize:14,color:C.warm,lineHeight:1.6,margin:0}}>{line||" "}</p>
          ))}
        </div>
        {/* 확인 버튼 */}
        <div style={{padding:"0 20px 20px"}}>
          <button
            onClick={onClose}
            style={{width:"100%",padding:"13px 0",borderRadius:12,background:C.terra,border:"none",color:C.white,fontSize:15,fontWeight:700,cursor:"pointer"}}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

const BottomSheet=({open,onClose,children,title,fullHeight})=>{
  if(!open)return null;
  const h=fullHeight?"88vh":"auto";
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:"20px 20px 0 0",padding:"24px 20px 0",width:"100%",maxWidth:430,animation:"slideUp .25s ease",maxHeight:"88vh",height:h,overflowY:fullHeight?"hidden":"auto",display:"flex",flexDirection:"column"}}>
        <div style={{width:40,height:4,background:C.light,borderRadius:2,margin:"0 auto 16px",flexShrink:0}}/>
        {title&&<div style={{fontSize:16,fontWeight:700,color:C.charcoal,marginBottom:16,flexShrink:0}}>{title}</div>}
        <div style={{flex:fullHeight?1:"none",overflowY:fullHeight?"hidden":"visible",display:"flex",flexDirection:"column",paddingBottom:fullHeight?0:40}}>
          {children}
        </div>
      </div>
    </div>
  );
};

const CROP_PRESETS=[{id:"free",label:"자유",ratio:null},{id:"1:1",label:"1:1",ratio:1},{id:"4:3",label:"4:3",ratio:4/3},{id:"3:4",label:"3:4",ratio:3/4},{id:"16:9",label:"16:9",ratio:16/9}];

function computeCropGeometry(containerW,containerH,imgNat,aspect,freeW,freeH,zoom,pan){
  if(!containerW||!containerH||!imgNat.w)return null;
  const ratio=aspect??(freeW/freeH);
  let cropW,cropH;
  if(aspect==null){
    cropW=containerW*(freeW/100);
    cropH=containerH*(freeH/100);
  }else if(ratio>=1){
    cropW=Math.min(containerW*0.88,containerH*0.88*ratio);
    cropH=cropW/ratio;
  }else{
    cropH=Math.min(containerH*0.88,containerW*0.88/ratio);
    cropW=cropH*ratio;
  }
  const cropX=(containerW-cropW)/2;
  const cropY=(containerH-cropH)/2;
  const imgAspect=imgNat.w/imgNat.h;
  let baseW,baseH;
  if(imgAspect>ratio){ baseH=cropH; baseW=baseH*imgAspect; }
  else{ baseW=cropW; baseH=baseW/imgAspect; }
  const displayW=baseW*zoom;
  const displayH=baseH*zoom;
  const imgX=cropX+cropW/2-displayW/2+pan.x;
  const imgY=cropY+cropH/2-displayH/2+pan.y;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const sx=clamp((cropX-imgX)/displayW*imgNat.w,0,imgNat.w-1);
  const sy=clamp((cropY-imgY)/displayH*imgNat.h,0,imgNat.h-1);
  const sw=clamp(cropW/displayW*imgNat.w,1,imgNat.w-sx);
  const sh=clamp(cropH/displayH*imgNat.h,1,imgNat.h-sy);
  return{cropX,cropY,cropW,cropH,imgX,imgY,displayW,displayH,sx,sy,sw,sh};
}

function cropImageDataUrl(src,geom){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(geom.sw));
      canvas.height=Math.max(1,Math.round(geom.sh));
      const ctx=canvas.getContext("2d");
      ctx.drawImage(img,geom.sx,geom.sy,geom.sw,geom.sh,0,0,canvas.width,canvas.height);
      resolve(canvas.toDataURL("image/jpeg",0.9));
    };
    img.onerror=()=>reject(new Error("이미지 처리에 실패했습니다."));
    img.src=src;
  });
}

const ImageCropEditor=({src,title="이미지 자르기",fixedAspect=null,onApply,onSkip,onCancel})=>{
  const boxRef=useRef(null);
  const[boxSize,setBoxSize]=useState({w:0,h:0});
  const[imgNat,setImgNat]=useState({w:0,h:0});
  const[preset,setPreset]=useState(fixedAspect!=null?"1:1":"4:3");
  const[freeW,setFreeW]=useState(80);
  const[freeH,setFreeH]=useState(70);
  const[zoom,setZoom]=useState(1);
  const[pan,setPan]=useState({x:0,y:0});
  const[drag,setDrag]=useState(null);
  const[busy,setBusy]=useState(false);

  const presetDef=CROP_PRESETS.find(p=>p.id===preset)??CROP_PRESETS[2];
  const aspect=fixedAspect??presetDef.ratio;

  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{ setImgNat({w:img.naturalWidth,h:img.naturalHeight}); setZoom(1); setPan({x:0,y:0}); };
    img.src=src;
  },[src]);

  useEffect(()=>{
    const el=boxRef.current;
    if(!el)return;
    const ro=new ResizeObserver(entries=>{
      const r=entries[0]?.contentRect;
      if(r) setBoxSize({w:r.width,h:r.height});
    });
    ro.observe(el);
    return()=>ro.disconnect();
  },[]);

  useEffect(()=>{ setZoom(1); setPan({x:0,y:0}); },[preset,freeW,freeH,fixedAspect]);

  const geom=computeCropGeometry(boxSize.w,boxSize.h,imgNat,aspect,freeW,freeH,zoom,pan);

  const onPtrDown=e=>{
    e.preventDefault();
    setDrag({sx:e.clientX,sy:e.clientY,px:pan.x,py:pan.y});
  };
  const onPtrMove=e=>{
    if(!drag)return;
    setPan({x:drag.px+(e.clientX-drag.sx),y:drag.py+(e.clientY-drag.sy)});
  };
  const onPtrUp=()=>setDrag(null);

  const handleApply=async()=>{
    if(!geom)return;
    setBusy(true);
    try{
      const out=await cropImageDataUrl(src,geom);
      onApply?.(out);
    }catch(e){
      showAlert(e.message||"자르기에 실패했습니다.");
    }finally{
      setBusy(false);
    }
  };

  return(
    <div>
      <div style={{fontSize:16,fontWeight:700,color:C.charcoal,marginBottom:4}}>{title}</div>
      <div style={{fontSize:12,color:C.warm,marginBottom:12}}>사진을 드래그·확대한 뒤 원하는 영역을 맞추세요</div>

      <div ref={boxRef} onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp} onPointerLeave={onPtrUp}
        style={{position:"relative",width:"100%",height:260,background:"#1a1a1a",borderRadius:12,overflow:"hidden",touchAction:"none",cursor:drag?"grabbing":"grab",marginBottom:12}}>
        {geom&&(
          <>
            <img src={src} alt="" draggable={false} style={{position:"absolute",left:geom.imgX,top:geom.imgY,width:geom.displayW,height:geom.displayH,userSelect:"none",pointerEvents:"none"}}/>
            <div style={{position:"absolute",top:0,left:0,right:0,height:geom.cropY,background:"rgba(0,0,0,0.45)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",top:geom.cropY+geom.cropH,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",top:geom.cropY,left:0,width:geom.cropX,height:geom.cropH,background:"rgba(0,0,0,0.45)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",top:geom.cropY,left:geom.cropX+geom.cropW,right:0,height:geom.cropH,background:"rgba(0,0,0,0.45)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",left:geom.cropX,top:geom.cropY,width:geom.cropW,height:geom.cropH,border:"2px solid white",borderRadius:4,boxShadow:"0 0 0 1px rgba(0,0,0,0.3)",pointerEvents:"none"}}/>
          </>
        )}
      </div>

      {fixedAspect==null&&(
        <>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {CROP_PRESETS.map(p=>(
              <button key={p.id} onClick={()=>setPreset(p.id)} style={{padding:"6px 12px",borderRadius:16,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:preset===p.id?C.terra:C.beige,color:preset===p.id?"white":C.warm}}>{p.label}</button>
            ))}
          </div>
          {preset==="free"&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:C.warm,marginBottom:4}}>가로 {freeW}% · 세로 {freeH}%</div>
              <input type="range" min={40} max={95} value={freeW} onChange={e=>setFreeW(Number(e.target.value))} style={{width:"100%",marginBottom:6,accentColor:C.terra}}/>
              <input type="range" min={40} max={95} value={freeH} onChange={e=>setFreeH(Number(e.target.value))} style={{width:"100%",accentColor:C.terra}}/>
            </div>
          )}
        </>
      )}

      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,color:C.warm,marginBottom:4}}>확대 {Math.round(zoom*100)}%</div>
        <input type="range" min={100} max={300} value={Math.round(zoom*100)} onChange={e=>setZoom(Number(e.target.value)/100)} style={{width:"100%",accentColor:C.terra}}/>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <button onClick={handleApply} disabled={busy||!geom} style={{width:"100%",padding:14,borderRadius:12,background:busy?C.light:C.terra,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:busy?"not-allowed":"pointer"}}>{busy?"처리 중…":"✂️ 자르기 적용"}</button>
        <button onClick={onSkip} style={{width:"100%",padding:14,borderRadius:12,background:C.beige,border:"none",fontSize:14,fontWeight:600,cursor:"pointer",color:C.charcoal}}>원본 그대로 올리기</button>
        {onCancel&&<button onClick={onCancel} style={{width:"100%",padding:12,borderRadius:12,background:"none",border:"none",fontSize:13,cursor:"pointer",color:C.warm}}>취소</button>}
      </div>
    </div>
  );
};

const BackBtn=({onClick})=>(
  <button onClick={onClick} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.warm,display:"flex",alignItems:"center",gap:4,marginBottom:16}}>← 뒤로</button>
);
const AdminActionBtns=({onEdit,onDelete})=>(
  <div style={{display:"flex",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
    {onEdit&&<button onClick={onEdit} style={{padding:"4px 10px",borderRadius:8,background:C.beige,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",color:C.charcoal}}>수정</button>}
    {onDelete&&<button onClick={onDelete} style={{padding:"4px 10px",borderRadius:8,background:"#FDEAEA",border:"none",fontSize:11,fontWeight:600,cursor:"pointer",color:C.red}}>삭제</button>}
  </div>
);

function feedbackPreview(text, maxLen = 52) {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "내용 없음";
  return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`;
}

const FeedbackRowMenu=({onEdit,onDelete})=>{
  const[open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const close=(e)=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("click",close);
    return()=>document.removeEventListener("click",close);
  },[open]);
  return(
    <div ref={ref} style={{position:"relative",flexShrink:0}} onClick={e=>e.stopPropagation()}>
      <button type="button" aria-label="피드백 메뉴" onClick={()=>setOpen(v=>!v)} style={{width:36,height:36,borderRadius:10,border:`1px solid ${C.light}`,background:C.white,cursor:"pointer",fontSize:17,color:C.charcoal,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>☰</button>
      {open&&(
        <div style={{position:"absolute",top:40,right:0,zIndex:30,background:C.white,borderRadius:10,border:`1px solid ${C.beige}`,boxShadow:"0 8px 24px rgba(61,53,48,0.14)",minWidth:128,overflow:"hidden"}}>
          {onEdit&&<button type="button" onClick={()=>{setOpen(false);onEdit();}} style={{display:"block",width:"100%",padding:"11px 14px",border:"none",background:"none",textAlign:"left",fontSize:13,fontWeight:600,color:C.charcoal,cursor:"pointer"}}>수정</button>}
          {onDelete&&<button type="button" onClick={()=>{setOpen(false);onDelete();}} style={{display:"block",width:"100%",padding:"11px 14px",border:"none",background:"none",textAlign:"left",fontSize:13,fontWeight:600,color:C.red,cursor:"pointer",borderTop:onEdit?`1px solid ${C.beige}`:"none"}}>삭제</button>}
        </div>
      )}
    </div>
  );
};

const FeedbackMessageRow=({feedback:f,showStudent=false,onOpen,onEdit,onDelete,extraBadges=null})=>{
  const unread=!f.read;
  return(
    <Card onClick={()=>onOpen?.(f)} style={{padding:"12px 14px",borderLeft:`3px solid ${unread?C.terra:C.sage}`,cursor:onOpen?"pointer":"default"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
        <div style={{width:28,height:28,borderRadius:8,background:unread?C.terraL:C.beige,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,color:unread?C.terra:C.warm}}>☰</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:4}}>
            <div style={{fontSize:13,fontWeight:700,color:C.charcoal,lineHeight:1.4}}>
              {showStudent&&<span>{f.studentName} · </span>}
              {f.artEmoji} {f.artwork||"수업 피드백"}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              {extraBadges}
              {unread?<Badge color="terra" small>미확인</Badge>:<Badge color="green" small>읽음</Badge>}
            </div>
          </div>
          <div style={{fontSize:11,color:C.warm,marginBottom:6}}>{f.date}</div>
          <div style={{fontSize:12,color:C.charcoal,lineHeight:1.5,opacity:0.88}}>{feedbackPreview(f.content)}</div>
        </div>
        {(onEdit||onDelete)&&<FeedbackRowMenu onEdit={onEdit} onDelete={onDelete}/>}
      </div>
    </Card>
  );
};

// ─── TABS ──────────────────────────────────────────────────
const ADMIN_TABS =[{id:"home",icon:"⌂",label:"홈"},{id:"students",icon:"◉",label:"학생"},{id:"artworks",icon:"◈",label:"작품"},{id:"chat",icon:"💬",label:"채팅"},{id:"schedule",icon:"📅",label:"일정"},{id:"more",icon:"⋯",label:"더보기"}];
const PARENT_TABS=[{id:"phome",icon:"🏠",label:"홈"},{id:"partworks",icon:"🖼",label:"작품"},{id:"pfeedback",icon:"💬",label:"피드백"},{id:"pschedule",icon:"📅",label:"일정"},{id:"pnotice",icon:"📢",label:"공지"},{id:"pchat",icon:"📨",label:"채팅"},{id:"psettings",icon:"⚙️",label:"설정"}];

// ══════════════════════════════════════════════════════════════
// 1. ADMIN HOME
// ══════════════════════════════════════════════════════════════
const AdminHome=({students,schedules,notices,feedbacks,onAttendTap,onNavigate,attendanceMap,logoSrc,classTimes,isNativeApp,onExitApp,plan,isMaster})=>{
  const generalNotices=useMemo(()=>notices.filter(n=>getNoticeScope(n)==="general"),[notices]);
  const[nowMins,setNowMins]=useState(()=>new Date().getHours()*60+new Date().getMinutes());
  const unreadFeedback=feedbacks.filter(f=>!f.read).length;
  useEffect(()=>{
    const tick=()=>setNowMins(new Date().getHours()*60+new Date().getMinutes());
    tick();
    const id=setInterval(tick,30000);
    return()=>clearInterval(id);
  },[]);
  const activeTime=getActiveClassTime(nowMins,classTimes);
  const todayCode=todayDowCode();
  const todayStr=new Date().toISOString().slice(0,10);
  const closedToday=isAcademyClosedOnDate(schedules,todayStr);
  const todayStudents=closedToday?[]:students.filter(s=>(s.classDay??[]).includes(todayCode));
  const activeStudents=activeTime?getActiveAttendanceStudents({
    students,schedules,dateStr:todayStr,dowCode:todayCode,activeTime,
  }):[];
  const unpaid=students.filter(s=>s.fee==="미납");
  const presentCount=activeTime?activeStudents.filter(s=>getAttendStatus(attendanceMap,s,activeTime)==="present").length:0;
  const nowLabel=`${String(Math.floor(nowMins/60)).padStart(2,"0")}:${String(nowMins%60).padStart(2,"0")}`;
  const todayLabel=formatKoreanDate();
  return(
    <div style={{padding:"0 16px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0 18px"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <div style={{fontSize:11,color:C.warm}}>{todayLabel} · {nowLabel}</div>
            <PlanBadge plan={plan} isMaster={isMaster}/>
            {isNativeApp&&onExitApp&&(
              <button onClick={onExitApp} style={{padding:"2px 8px",borderRadius:12,background:"rgba(193,127,91,0.12)",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",color:C.warm,lineHeight:1.4}}>✕ 종료</button>
            )}
          </div>
          <Logo w={90} src={logoSrc}/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div onClick={()=>onNavigate("notice",{keepTab:true})} style={{width:38,height:38,borderRadius:19,background:C.beige,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,cursor:"pointer",position:"relative"}}>
            📢{generalNotices.some(n=>n.important)&&<div style={{position:"absolute",top:5,right:5,width:8,height:8,borderRadius:4,background:C.red,border:"2px solid white"}}/>}
          </div>
          <div onClick={()=>onNavigate("feedback_history",{keepTab:true})} style={{width:38,height:38,borderRadius:19,background:C.beige,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,cursor:"pointer",position:"relative"}}>
            🔔{unreadFeedback>0&&<div style={{position:"absolute",top:5,right:5,width:8,height:8,borderRadius:4,background:C.red,border:"2px solid white"}}/>}
          </div>
        </div>
      </div>

      {closedToday&&(
        <Card style={{marginBottom:14,background:"#FFF5F5",border:"1px solid #F5C6C6",textAlign:"center",padding:"14px 16px"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#C0392B"}}>오늘은 휴원/공휴일입니다</div>
          <div style={{fontSize:12,color:C.warm,marginTop:4}}>정규 수업 일정이 표시되지 않습니다 · 보강 일정만 출결 가능</div>
        </Card>
      )}

      <div style={{display:"flex",gap:10,marginBottom:20}}>
        {[{l:closedToday?"보강/일정":"오늘 수업",v:closedToday?activeStudents.length:todayStudents.length,c:C.terra},{l:activeTime?`${activeTime} 출석`:"출석",v:presentCount,c:C.sage},{l:"이달 미납",v:unpaid.length,c:C.red}].map(s=>(
          <Card key={s.l} style={{flex:1,padding:12,textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:C.warm,marginTop:2}}>{s.l}</div>
          </Card>
        ))}
      </div>

      {/* Current class attendance — 30 min before ~ 30 min after class start */}
      <div style={{marginBottom:20}}>
        <SecTitle action={activeTime?"전체보기 →":undefined} onAction={()=>onNavigate("students")}>📅 출결 — {activeTime?`${activeTime} 수업`:"대기 중"}</SecTitle>
        {!activeTime?(
          <Card style={{textAlign:"center",padding:"24px 16px",color:C.warm,fontSize:13,lineHeight:1.7}}>
            현재 출결 가능한 수업이 없습니다.<br/>
            <span style={{fontSize:12}}>수업 30분 전 ~ 30분 후까지 해당 시간대 학생이 표시됩니다.</span>
          </Card>
        ):activeStudents.length===0?(
          <Card style={{textAlign:"center",padding:"24px 16px",color:C.warm,fontSize:13}}>
            {classWindowLabel(activeTime)} · 오늘 이 시간 수업 학생 없음
          </Card>
        ):(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <Badge color="blue" small>🕐 {activeTime} · {classWindowLabel(activeTime)}</Badge>
                <span style={{fontSize:11,color:C.warm}}>{activeStudents.length}명</span>
              </div>
              <span style={{fontSize:11,color:C.warm,flexShrink:0}}>
                {activeStudents.filter(s=>getAttendStatus(attendanceMap,s,activeTime)).length}/{activeStudents.length}명 처리
              </span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {activeStudents.map(s=>{
                const curStatus=getAttendStatus(attendanceMap,s,activeTime);
                return(
                  <Card key={s.id} onClick={()=>onAttendTap({...s,attendTime:activeTime,attendStatus:curStatus,isMakeupSession:s.isMakeupSession})} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px"}}>
                    <StudentAvatar student={s} size={44} fontSize={24}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{s.name}</div>
                        {s.isMakeupSession&&<Badge small color="green">보강</Badge>}
                      </div>
                      <div style={{fontSize:11,color:C.warm,marginTop:2}}>{s.grade} · {deptLabel(getDept(s.grade))}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                      {curStatus?<StatusChip s={curStatus}/>:<span style={{fontSize:11,color:C.terra,fontWeight:600}}>터치 →</span>}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Unpaid alert */}
      {unpaid.length>0&&(
        <Card onClick={()=>onNavigate("payments")} style={{border:`1px solid #FDEAEA`,background:"#FFFAFA",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:24}}>💸</span>
            <div><div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>미납 학생 {unpaid.length}명</div><div style={{fontSize:12,color:C.warm,marginTop:2}}>{unpaid.map(s=>s.name).join(", ")}</div></div>
            <span style={{marginLeft:"auto",fontSize:14,color:C.terra}}>→</span>
          </div>
        </Card>
      )}

      {/* Offline queue badge — shows when there are pending items */}
      {false /* replaced by banner — see OfflineBanner */}

      {/* Notice preview */}
      <Card onClick={()=>onNavigate("notice")} style={{border:`1px solid ${C.beige}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>📢</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:C.charcoal,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{generalNotices[0]?.title??""}</div>
            <div style={{fontSize:11,color:C.warm,marginTop:2}}>{generalNotices[0]?.date??""}</div>
          </div>
          <Badge color="red" small>중요</Badge>
        </div>
      </Card>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 2. ATTENDANCE MODAL (1-touch)
// ══════════════════════════════════════════════════════════════
const AttendModal=({student,onClose,onSave})=>{
  const[sel,setSel]=useState(student.status??null);
  const[done,setDone]=useState(false);
  const opts=[{id:"present",label:"✅ 출석",c:C.sage,bg:"#E8F4EA"},{id:"late",label:"⏰ 지각",c:C.gold,bg:"#FDF5E0"},{id:"absent",label:"❌ 결석",c:C.red,bg:"#FDEAEA"},{id:"makeup",label:"🔄 보강",c:C.blue,bg:"#E8EFF5"}];
  const save=()=>{setDone(true);setTimeout(()=>onSave(student.id,sel),900);};
  return(
    <BottomSheet open onClose={onClose}>
      {done?(
        <div style={{textAlign:"center",padding:"16px 0"}}>
          <div style={{fontSize:48,marginBottom:10}}>{{present:"✅",late:"⏰",absent:"❌",makeup:"🔄"}[sel]??""}</div>
          <div style={{fontSize:17,fontWeight:700,color:C.charcoal}}>저장 완료!</div>
          <div style={{fontSize:13,color:C.warm,marginTop:4}}>학부모 앱으로 출결 알림이 전달됩니다</div>
        </div>
      ):(
        <>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:40,marginBottom:8}}>{student.art}</div>
            <div style={{fontSize:18,fontWeight:700,color:C.charcoal}}>{student.name}</div>
            <div style={{fontSize:12,color:C.warm}}>{student.school} {student.grade}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {opts.map(o=>(
              <button key={o.id} onClick={()=>setSel(o.id)} style={{padding:14,borderRadius:12,border:`2px solid ${sel===o.id?o.c:"transparent"}`,background:sel===o.id?o.bg:C.beige,fontSize:15,fontWeight:700,cursor:"pointer",color:sel===o.id?o.c:C.warm,transition:"all .15s"}}>{o.label}</button>
            ))}
          </div>
          <button onClick={save} disabled={!sel} style={{width:"100%",padding:16,background:sel?C.terra:C.light,color:"white",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:sel?"pointer":"not-allowed"}}>저장 + 학부모 알림 발송</button>
        </>
      )}
    </BottomSheet>
  );
};

// ══════════════════════════════════════════════════════════════
// 3. STUDENTS LIST + DETAIL
// ══════════════════════════════════════════════════════════════
const AdminStudents=({students,onSelect,onUpdateStudent,onAddStudent,onDeleteStudent,linkedStudentIds,academyOptions,onUpdateAcademyOptions,attendanceRecords=[],academy})=>{
  const[classTimes,setClassTimes]=useState(academyOptions.classTimes);
  useEffect(()=>{ setClassTimes(academyOptions.classTimes); }, [academyOptions.classTimes]);
  const allClassTimes=[...new Set([...classTimes,...students.map(s=>s.classTime).filter(Boolean)])].sort();
  const[search,setSearch]=useState("");
  const[filter,setFilter]=useState("all");
  const[showUnlinkedOnly,setShowUnlinkedOnly]=useState(false);
  const[showReg,setShowReg]=useState(false);
  const[editStudent,setEditStudent]=useState(null);
  const isLinked=(s)=>linkedStudentIds?.has(String(s.id));
  const unlinkedCount=students.filter(s=>!isLinked(s)).length;
  const filtered=students.filter(s=>{
    const matchesSearch=s.name.includes(search)||s.school.includes(search);
    if(showUnlinkedOnly) return !isLinked(s)&&matchesSearch;
    return matchesSearch&&(filter==="all"||getDept(s.grade)===filter);
  });
  const groups=filter==="all"?DEPTS.filter(d=>d.id!=="all").map(d=>({...d,students:filtered.filter(s=>getDept(s.grade)===d.id)})).filter(g=>g.students.length>0):[{id:filter,l:deptLabel(filter),students:filtered}];
  const handleDeleteStudent=(s,e)=>{
    e?.stopPropagation?.();
    if(!window.confirm(`${s.name} 학생을 목록에서 삭제할까요?\n\n작품·출결·피드백 등 관련 데이터도 함께 삭제됩니다.`))return;
    void onDeleteStudent(s.id).catch(err=>catchUserAction(err,"학생 삭제에 실패했습니다."));
  };
  const renderStudent=s=>{
    const linked=isLinked(s);
    return(
    <Card key={s.id} onClick={()=>onSelect(s)} style={{
      display:"flex",gap:12,alignItems:"center",
      border:linked?`1px solid ${C.beige}`:`2px solid #F0C987`,
      background:linked?C.white:"#FFFBF5",
      boxShadow:linked?"none":"0 2px 10px rgba(240,201,135,0.25)",
    }}>
      <StudentAvatar student={s} size={50} fontSize={26}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
          <span style={{fontSize:15,fontWeight:700,color:C.charcoal}}>{s.name}</span>
          <span style={{fontSize:11,color:C.warm}}>{s.school} {s.grade}</span>
          {!linked&&<Badge small color="gold">👤 학부모 미연결</Badge>}
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <select
            value={s.classTime??"15:00"}
            onClick={e=>e.stopPropagation()}
            onChange={e=>{e.stopPropagation();onUpdateStudent(s.id,{classTime:e.target.value}).catch(err=>catchUserAction(err,"수업 시간 변경에 실패했습니다."));}}
            style={{padding:"3px 8px",borderRadius:20,border:`1px solid ${C.light}`,background:"#E8EFF5",fontSize:11,fontWeight:600,color:C.blue,cursor:"pointer",outline:"none"}}
          >
            {allClassTimes.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          {(s.classDay??[]).map(d=><Badge key={d} small color="terra">{dayName(d)}</Badge>)}
          {s.tags.slice(0,2).map(t=><Badge key={t} small>{t}</Badge>)}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
        <AdminActionBtns
          onEdit={()=>setEditStudent(s)}
          onDelete={onDeleteStudent?()=>handleDeleteStudent(s):undefined}
        />
        <Badge color={s.fee==="납부완료"?"green":s.fee.includes("예정")?"gold":"red"} small>{s.fee}</Badge>
        <span style={{fontSize:11,color:C.warm}}>작품 {s.artCount}개</span>
      </div>
    </Card>
  );};
  return(
    <div style={{padding:"0 16px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0"}}>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>학생 관리 ({students.length}명)</div>
          {unlinkedCount>0&&(
            <div style={{fontSize:12,color:C.gold,marginTop:4,fontWeight:600}}>
              👤 학부모 미연결 {unlinkedCount}명 · 노란 테두리로 표시됩니다
            </div>
          )}
        </div>
        <button onClick={()=>setShowReg(true)} style={{background:C.terra,color:"white",border:"none",borderRadius:20,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 학생 등록</button>
      </div>
      <Card style={{marginBottom:16}}>
        <div style={{fontSize:12,color:C.warm,marginBottom:10}}>월별 학생 출석부를 Word 파일로 저장합니다</div>
        <AttendanceExportBtn students={students} attendanceRecords={attendanceRecords} academy={academy}/>
      </Card>
      <div style={{display:"flex",alignItems:"center",gap:8,background:C.beige,borderRadius:12,padding:"10px 14px",marginBottom:12}}>
        <span style={{color:C.warm}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름, 학교로 검색" style={{flex:1,border:"none",background:"none",fontSize:14,color:C.charcoal,outline:"none"}}/>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto",alignItems:"center"}}>
        {DEPTS.map(f=><button key={f.id} onClick={()=>{setFilter(f.id);setShowUnlinkedOnly(false);}} style={{flexShrink:0,padding:"6px 14px",borderRadius:20,border:filter===f.id&&!showUnlinkedOnly?"none":`1px solid ${C.light}`,background:filter===f.id&&!showUnlinkedOnly?C.terra:C.white,color:filter===f.id&&!showUnlinkedOnly?"white":C.warm,fontSize:12,fontWeight:600,cursor:"pointer"}}>{f.l}</button>)}
        {unlinkedCount>0&&(
          <button onClick={()=>setShowUnlinkedOnly(v=>!v)} style={{flexShrink:0,padding:"6px 14px",borderRadius:20,border:showUnlinkedOnly?"none":`1px solid #F0C987`,background:showUnlinkedOnly?"#F0C987":C.white,color:showUnlinkedOnly?C.charcoal:C.gold,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            👤 미연결 {unlinkedCount}
          </button>
        )}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {groups.map(g=>(
          <div key={g.id}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <span style={{fontSize:13,fontWeight:800,color:C.charcoal}}>{g.l}</span>
              <Badge small color="terra">{g.students.length}명</Badge>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {g.students.map(renderStudent)}
            </div>
          </div>
        ))}
        {filtered.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.warm,fontSize:13}}>검색 결과가 없습니다</div>}
      </div>
      {showReg&&<StudentRegisterModal onClose={()=>setShowReg(false)} onSave={onAddStudent} academyOptions={academyOptions} onUpdateAcademyOptions={onUpdateAcademyOptions}/>}
      {editStudent&&<StudentRegisterModal initial={editStudent} onClose={()=>setEditStudent(null)} onSave={async updated=>{try{await onUpdateStudent(editStudent.id,updated);setEditStudent(null);}catch{/* alert in handler */}}} academyOptions={academyOptions} onUpdateAcademyOptions={onUpdateAcademyOptions}/>}
    </div>
  );
};


// ══════════════════════════════════════════════════════════════
// STUDENT REGISTER FORM
// ══════════════════════════════════════════════════════════════
const EditableOptionList=({label,options,selected,onSelect,onAdd,onRemove,formatLabel,parseValue,addPlaceholder})=>{
  const[draft,setDraft]=useState("");
  const handleAdd=()=>{
    const val=parseValue(draft);
    if(val==null)return;
    onAdd(val);
    onSelect(val);
    setDraft("");
  };
  return(
    <div style={{marginBottom:14}}>
      <div style={{fontSize:12,color:C.warm,marginBottom:8}}>{label}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
        {options.map(opt=>(
          <div key={opt} style={{display:"inline-flex",alignItems:"center",gap:2}}>
            <button type="button" onClick={()=>onSelect(opt)} style={{padding:"8px 14px",borderRadius:20,background:selected===opt?C.terra:C.beige,color:selected===opt?"white":C.warm,border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>{formatLabel(opt)}</button>
            {options.length>1&&(
              <button type="button" onClick={()=>onRemove(opt)} style={{width:22,height:22,borderRadius:11,background:"#FDEAEA",border:"none",color:C.red,fontSize:14,cursor:"pointer",lineHeight:1}}>×</button>
            )}
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8}}>
        <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder={addPlaceholder}
          style={{flex:1,padding:"8px 12px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:13,outline:"none",background:C.cream}}/>
        <button type="button" onClick={handleAdd} style={{padding:"8px 14px",borderRadius:10,background:C.sage,color:"white",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>+ 추가</button>
      </div>
    </div>
  );
};

const StudentRegisterModal=({onClose,onSave,initial=null,academyOptions,onUpdateAcademyOptions})=>{
  const isEdit=!!initial;
  const[name,setName]=useState(initial?.name??"");
  const[school,setSchool]=useState(initial?.school??"");
  const[grade,setGrade]=useState(initial?.grade??"초1");
  const[gender,setGender]=useState(initial?.gender??"");
  const[phone,setPhone]=useState(initial?.phone??"");
  const[parentPhone,setParentPhone]=useState(initial?.parentPhone??"");
  const[days,setDays]=useState(initial?.classDay??[]);
  const[classTime,setClassTime]=useState(initial?.classTime??academyOptions.classTimes[0]??"15:00");
  const[fee,setFee]=useState(initial?.monthlyFee??academyOptions.monthlyFees[0]??150000);
  const[feeDay,setFeeDay]=useState(initial?.feeDueDay??academyOptions.feeDueDays[0]??5);
  const[memo,setMemo]=useState(initial?.memo??"");
  const[step,setStep]=useState(1);
  const[saving,setSaving]=useState(false);

  const GRADES=["유4","유5","유6","유7","초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3"];
  const DAYS=[{id:"MON",l:"월"},{id:"TUE",l:"화"},{id:"WED",l:"수"},{id:"THU",l:"목"},{id:"FRI",l:"금"}];
  const ARTS=["🌸","🦋","🌊","🏔️","🌻","🎭","🌈","🦚","🎨","🌺","🍎","🐠"];
  const[selArt,setSelArt]=useState(initial?.art??"🎨");
  const[avatarMode,setAvatarMode]=useState(()=>{
    if(initial?.useEmojiAvatar) return "emoji";
    if(initial?.photoUri) return "photo";
    return "default";
  });
  const[photoUri,setPhotoUri]=useState(initial?.photoUri??null);
  const[rawPhotoUri,setRawPhotoUri]=useState(null);
  const[photoLoading,setPhotoLoading]=useState(false);
  const avatarFileRef=useRef(null);

  const toggleDay=(d)=>setDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d]);

  const afterAvatarPick=(uri)=>{
    setRawPhotoUri(uri);
    setPhotoUri(null);
  };

  const pickAvatarNative=async(type)=>{
    if(!window.ArtlogNative?.isNative)return false;
    setPhotoLoading(true);
    try{
      const result=type==="camera"
        ? await window.ArtlogNative.openCamera()
        : await window.ArtlogNative.openGallery();
      if(result?.uri) afterAvatarPick(result.uri);
      return true;
    }catch(e){
      showAlert(e.message||"사진 선택에 실패했습니다.");
      return true;
    }finally{
      setPhotoLoading(false);
    }
  };

  const openAvatarCamera=async()=>{
    if(await pickAvatarNative("camera"))return;
    avatarFileRef.current?.click();
  };

  const openAvatarGallery=async()=>{
    if(await pickAvatarNative("gallery"))return;
    avatarFileRef.current?.click();
  };

  const handleAvatarFilePick=e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    if(!file.type.startsWith("image/")){
      showAlert("이미지 파일을 선택해 주세요.");
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>afterAvatarPick(reader.result);
    reader.readAsDataURL(file);
    e.target.value="";
  };

  const selectEmojiAvatar=(emoji)=>{
    setSelArt(emoji);
    setPhotoUri(null);
    setRawPhotoUri(null);
    setAvatarMode("emoji");
  };

  const addClassTime=(t)=>{
    if(!academyOptions.classTimes.includes(t)) onUpdateAcademyOptions({ classTimes:[...academyOptions.classTimes,t].sort() });
  };
  const removeClassTime=(t)=>{
    const next=academyOptions.classTimes.filter(x=>x!==t);
    if(!next.length)return;
    onUpdateAcademyOptions({ classTimes:next });
    if(classTime===t)setClassTime(next[0]);
  };
  const addFee=(v)=>{
    if(!academyOptions.monthlyFees.includes(v)) onUpdateAcademyOptions({ monthlyFees:[...academyOptions.monthlyFees,v].sort((a,b)=>a-b) });
  };
  const removeFee=(v)=>{
    const next=academyOptions.monthlyFees.filter(x=>x!==v);
    if(!next.length)return;
    onUpdateAcademyOptions({ monthlyFees:next });
    if(fee===v)setFee(next[0]);
  };
  const addFeeDay=(d)=>{
    if(!academyOptions.feeDueDays.includes(d)) onUpdateAcademyOptions({ feeDueDays:[...academyOptions.feeDueDays,d].sort((a,b)=>a-b) });
  };
  const removeFeeDay=(d)=>{
    const next=academyOptions.feeDueDays.filter(x=>x!==d);
    if(!next.length)return;
    onUpdateAcademyOptions({ feeDueDays:next });
    if(feeDay===d)setFeeDay(next[0]);
  };

  const parseTimeInput=(raw)=>{
    const t=raw.trim();
    if(/^\d{1,2}:\d{2}$/.test(t)){
      const [h,m]=t.split(":").map(Number);
      if(h>=0&&h<24&&m>=0&&m<60) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
    }
    return null;
  };
  const parseFeeInput=(raw)=>{
    const n=Number(String(raw).replace(/[^\d]/g,""));
    if(!n||n<10000)return null;
    return Math.round(n/10000)*10000;
  };
  const parseDayInput=(raw)=>{
    const d=Number(String(raw).replace(/\D/g,""));
    if(d>=1&&d<=31)return d;
    return null;
  };

  const save=async ()=>{
    if(!name.trim())return;
    if(!gender){
      showAlert("성별을 선택해 주세요.");
      return;
    }
    const payload={
      name,school,grade,gender,phone,parentPhone,
      classDay:days,classTime,monthlyFee:fee,feeDueDay:feeDay,memo,
      art:selArt,
      useEmojiAvatar: avatarMode === "emoji",
      photoUri: avatarMode === "photo" ? photoUri : null,
    };
    setSaving(true);
    try {
      if(isEdit){
        await onSave({...initial,...payload});
      }else{
        await onSave({
          id:`s${Date.now()}`,...payload,
          artCount:0,fee:"미납",status:null,
          tags:[],enroll:new Date().toISOString().slice(0,10),
        });
      }
      onClose();
    } catch {
      // onSave (onAddStudent/onUpdateStudent) already shows the error alert
    } finally {
      setSaving(false);
    }
  };

  return(
    <BottomSheet open onClose={onClose} title={isEdit?"학생 정보 수정":"학생 등록"}>
      {/* Step indicator */}
      <div style={{display:"flex",gap:6,marginBottom:20,justifyContent:"center"}}>
        {[1,2].map(s=><div key={s} style={{width:s===step?24:8,height:8,borderRadius:4,background:s<=step?C.terra:C.light,transition:"all .3s"}}/>)}
      </div>

      {step===1&&(
        <div>
          <input ref={avatarFileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarFilePick}/>
          <div style={{fontSize:15,fontWeight:700,color:C.charcoal,marginBottom:16}}>① 기본 정보</div>

          {/* Avatar pick */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:C.warm,marginBottom:8}}>아이콘 · 사진</div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              {avatarMode === "photo" && photoUri ? (
                <img src={photoUri} alt="프로필" style={{width:64,height:64,borderRadius:32,objectFit:"cover",border:`2px solid ${C.terra}`}}/>
              ) : avatarMode === "emoji" ? (
                <StudentAvatar student={{ art: selArt, useEmojiAvatar: true }} size={64} fontSize={30}/>
              ) : (
                <img src={DEFAULT_STUDENT_AVATAR_URL} alt="기본 프로필" style={{width:64,height:64,borderRadius:32,objectFit:"cover",border:`2px solid ${C.light}`}}/>
              )}
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:C.warm,marginBottom:8}}>사진·이모지 미선택 시 기본 이미지가 등록됩니다</div>
                <div style={{display:"flex",gap:8}}>
                  <button type="button" onClick={openAvatarCamera} disabled={photoLoading} style={{flex:1,padding:"8px 0",borderRadius:10,background:C.beige,border:"none",fontSize:12,fontWeight:600,cursor:photoLoading?"not-allowed":"pointer",color:C.charcoal}}>{photoLoading?"…":"📷 촬영"}</button>
                  <button type="button" onClick={openAvatarGallery} disabled={photoLoading} style={{flex:1,padding:"8px 0",borderRadius:10,background:C.beige,border:"none",fontSize:12,fontWeight:600,cursor:photoLoading?"not-allowed":"pointer",color:C.charcoal}}>{photoLoading?"…":"🖼 앨범"}</button>
                </div>
              </div>
            </div>
            {rawPhotoUri&&(
              <div style={{marginBottom:12}}>
                <ImageCropEditor
                  src={rawPhotoUri}
                  title="프로필 사진 자르기"
                  fixedAspect={1}
                  onApply={uri=>{ setPhotoUri(uri); setRawPhotoUri(null); setAvatarMode("photo"); }}
                  onSkip={()=>{ setPhotoUri(rawPhotoUri); setRawPhotoUri(null); setAvatarMode("photo"); }}
                  onCancel={()=>{ setRawPhotoUri(null); setPhotoUri(initial?.photoUri??null); setAvatarMode(initial?.useEmojiAvatar?"emoji":initial?.photoUri?"photo":"default"); }}
                />
              </div>
            )}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {ARTS.map(e=>(
                <div key={e} onClick={()=>selectEmojiAvatar(e)} style={{width:40,height:40,borderRadius:10,background:avatarMode==="emoji"&&selArt===e?"#FFF0E6":C.beige,border:`2px solid ${avatarMode==="emoji"&&selArt===e?C.terra:"transparent"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,cursor:"pointer",opacity:avatarMode==="photo"?0.45:1}}>{e}</div>
              ))}
            </div>
          </div>

          {[
            {label:"이름 *",val:name,set:setName,ph:"홍길동"},
            {label:"학교",val:school,set:setSchool,ph:"한별초등학교"},
            {label:"학생 연락처",val:phone,set:setPhone,ph:"010-0000-0000"},
            {label:"학부모 연락처",val:parentPhone,set:setParentPhone,ph:"010-0000-0000"},
          ].map(f=>(
            <div key={f.label} style={{marginBottom:12}}>
              <div style={{fontSize:12,color:C.warm,marginBottom:4}}>{f.label}</div>
              <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                style={{width:"100%",padding:"10px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:14,outline:"none",background:C.cream,color:C.charcoal}}/>
            </div>
          ))}

          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:C.warm,marginBottom:8}}>성별 *</div>
            <div style={{display:"flex",gap:8}}>
              {[["male","남자"],["female","여자"]].map(([id,l])=>(
                <button key={id} type="button" onClick={()=>setGender(id)} style={{flex:1,padding:"10px 0",borderRadius:10,background:gender===id?C.terra:C.beige,color:gender===id?"white":C.warm,border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>{l}</button>
              ))}
            </div>
          </div>

          {/* Grade picker */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:C.warm,marginBottom:8}}>학년</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {GRADES.map(g=>(
                <button key={g} type="button" onClick={()=>setGrade(g)} style={{padding:"6px 12px",borderRadius:20,background:grade===g?C.terra:C.beige,color:grade===g?"white":C.warm,border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>{g}</button>
              ))}
            </div>
          </div>

          <button onClick={()=>name.trim()&&gender&&setStep(2)} style={{width:"100%",padding:14,borderRadius:12,background:name.trim()&&gender?C.terra:C.light,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:name.trim()&&gender?"pointer":"not-allowed"}}>다음 →</button>
        </div>
      )}

      {step===2&&(
        <div>
          <div style={{fontSize:15,fontWeight:700,color:C.charcoal,marginBottom:16}}>② 수업 정보</div>

          <EditableOptionList
            label="수업 시간"
            options={academyOptions.classTimes}
            selected={classTime}
            onSelect={setClassTime}
            onAdd={addClassTime}
            onRemove={removeClassTime}
            formatLabel={t=>t}
            parseValue={parseTimeInput}
            addPlaceholder="18:00"
          />

          {/* Class days */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:C.warm,marginBottom:8}}>수업 요일 (복수 선택)</div>
            <div style={{display:"flex",gap:8}}>
              {DAYS.map(d=>(
                <button key={d.id} type="button" onClick={()=>toggleDay(d.id)} style={{flex:1,padding:"12px 0",borderRadius:12,background:days.includes(d.id)?C.terra:C.beige,color:days.includes(d.id)?"white":C.warm,border:"none",fontSize:14,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>{d.l}</button>
              ))}
            </div>
          </div>

          <EditableOptionList
            label="월 수강료"
            options={academyOptions.monthlyFees}
            selected={fee}
            onSelect={setFee}
            onAdd={addFee}
            onRemove={removeFee}
            formatLabel={v=>`${v/10000}만원`}
            parseValue={parseFeeInput}
            addPlaceholder="180000"
          />

          <EditableOptionList
            label="결제일 (매월)"
            options={academyOptions.feeDueDays}
            selected={feeDay}
            onSelect={setFeeDay}
            onAdd={addFeeDay}
            onRemove={removeFeeDay}
            formatLabel={d=>`${d}일`}
            parseValue={parseDayInput}
            addPlaceholder="28"
          />

          {/* Memo */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:C.warm,marginBottom:4}}>상담 메모 (선택)</div>
            <textarea value={memo} onChange={e=>setMemo(e.target.value)} rows={3} placeholder="학생 성향, 특이사항 등" style={{width:"100%",padding:"10px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:13,outline:"none",background:C.cream,color:C.charcoal,resize:"none",fontFamily:"inherit"}}/>
          </div>

          <div style={{display:"flex",gap:10}}>
            <button type="button" onClick={()=>setStep(1)} style={{flex:1,padding:14,borderRadius:12,background:C.beige,border:"none",fontSize:14,cursor:"pointer",color:C.charcoal}}>← 이전</button>
            <button type="button" onClick={save} disabled={saving} style={{flex:2,padding:14,borderRadius:12,background:saving?C.light:C.terra,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>{saving?"저장 중…":isEdit?"저장 ✓":"등록 완료 ✓"}</button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
};

// ─── ExamScoreManager ─────────────────────────────────────────
const PRACTICAL_KEYS = ["형태력","채색력","표현력","속도","아이디어"];
const ExamScoreManager = ({ student, academyId }) => {
  const { useExamScores, useExamScoreMutations } = window.__artlogHooks__ || {};
  const [showForm, setShowForm] = useState(false);
  const [scores, setScores] = useState([]);
  const [form, setForm] = useState({ exam_date:"", practical_scores:{}, suneung_score:"", naesin_grade:"", target_schools:"", memo:"" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!academyId || !student?.id) return;
    let sb; try { sb = requireSupabase(); } catch { return; }
    sb.from("exam_scores").select("*").eq("academy_id", academyId).eq("student_id", student.id)
      .order("exam_date", { ascending: false })
      .then(({ data }) => { if (data) setScores(data); });
  }, [academyId, student?.id, saving]);

  const handleSave = async () => {
    if (!form.exam_date) { showAlert("시험 날짜를 입력하세요"); return; }
    setSaving(true);
    try {
      const sb = requireSupabase();
      await sb.from("exam_scores").insert({
        academy_id: academyId,
        student_id: student.id,
        exam_date: form.exam_date,
        practical_scores: form.practical_scores,
        suneung_score: form.suneung_score ? parseInt(form.suneung_score) : null,
        naesin_grade: form.naesin_grade ? parseFloat(form.naesin_grade) : null,
        target_schools: form.target_schools ? form.target_schools.split(",").map(s=>s.trim()).filter(Boolean) : [],
        memo: form.memo,
      });
      setShowForm(false);
      setForm({ exam_date:"", practical_scores:{}, suneung_score:"", naesin_grade:"", target_schools:"", memo:"" });
    } catch(e) { showAlert("저장 실패: " + e.message); }
    setSaving(false);
  };
  const handleDelete = async (id) => {
    if (!window.confirm("이 기록을 삭제할까요?")) return;
    try {
      const sb = requireSupabase();
      await sb.from("exam_scores").delete().eq("id", id);
      setScores(prev => prev.filter(s => s.id !== id));
    } catch(e) { showAlert("삭제 실패: " + e.message); }
  };

  const latest = scores[0];
  const radarData = latest?.practical_scores || {};

  const RadarChart = () => {
    const cx=80, cy=80, r=60;
    const n=PRACTICAL_KEYS.length;
    const pts = PRACTICAL_KEYS.map((k,i) => {
      const angle = (Math.PI*2/n)*i - Math.PI/2;
      const val = (radarData[k]||0)/100;
      return [cx+r*val*Math.cos(angle), cy+r*val*Math.sin(angle)];
    });
    const gridPts = (ratio) => PRACTICAL_KEYS.map((_,i) => {
      const angle = (Math.PI*2/n)*i - Math.PI/2;
      return `${cx+r*ratio*Math.cos(angle)},${cy+r*ratio*Math.sin(angle)}`;
    }).join(" ");
    const polyPts = pts.map(p=>p.join(",")).join(" ");
    const labelPts = PRACTICAL_KEYS.map((k,i) => {
      const angle = (Math.PI*2/n)*i - Math.PI/2;
      const lr = r+18;
      return { k, x: cx+lr*Math.cos(angle), y: cy+lr*Math.sin(angle) };
    });
    return (
      <svg width={160} height={160} style={{display:"block",margin:"0 auto"}}>
        {[0.25,0.5,0.75,1].map(ratio=>(
          <polygon key={ratio} points={gridPts(ratio)} fill="none" stroke="#E8DDD0" strokeWidth={1}/>
        ))}
        {PRACTICAL_KEYS.map((_,i)=>{
          const angle=(Math.PI*2/n)*i-Math.PI/2;
          return <line key={i} x1={cx} y1={cy} x2={cx+r*Math.cos(angle)} y2={cy+r*Math.sin(angle)} stroke="#E8DDD0" strokeWidth={1}/>;
        })}
        <polygon points={polyPts} fill="rgba(193,127,91,0.25)" stroke="#C17F5B" strokeWidth={2}/>
        {pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={3} fill="#C17F5B"/>)}
        {labelPts.map(({k,x,y})=>(
          <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#8C7B72">{k}</text>
        ))}
      </svg>
    );
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {latest && (
        <Card>
          <div style={{fontSize:12,color:C.warm,marginBottom:8,fontWeight:600}}>최근 실기 점수 레이더</div>
          <RadarChart/>
          <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginTop:8}}>
            {PRACTICAL_KEYS.map(k=>(
              <div key={k} style={{textAlign:"center",minWidth:44}}>
                <div style={{fontSize:14,fontWeight:700,color:C.terra}}>{radarData[k]||0}</div>
                <div style={{fontSize:9,color:C.warm}}>{k}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <button onClick={()=>setShowForm(!showForm)} style={{padding:"10px 0",borderRadius:12,background:C.terra,color:"white",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>
        {showForm?"취소":"+ 시험 기록 추가"}
      </button>
      {showForm && (
        <Card>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div><div style={{fontSize:11,color:C.warm,marginBottom:3}}>시험 날짜</div>
              <input type="date" value={form.exam_date} onChange={e=>setForm(f=>({...f,exam_date:e.target.value}))}
                style={{width:"100%",padding:"8px 10px",border:`1px solid ${C.light}`,borderRadius:8,fontSize:13,color:C.charcoal,outline:"none"}}/>
            </div>
            <div><div style={{fontSize:11,color:C.warm,marginBottom:6,fontWeight:600}}>실기 점수 (0-100)</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {PRACTICAL_KEYS.map(k=>(
                  <div key={k}>
                    <div style={{fontSize:10,color:C.warm,marginBottom:2}}>{k}</div>
                    <input type="number" min={0} max={100} value={form.practical_scores[k]||""} onChange={e=>setForm(f=>({...f,practical_scores:{...f.practical_scores,[k]:Number(e.target.value)}}))}
                      placeholder="0~100" style={{width:"100%",padding:"6px 8px",border:`1px solid ${C.light}`,borderRadius:8,fontSize:13,color:C.charcoal,outline:"none"}}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}><div style={{fontSize:11,color:C.warm,marginBottom:2}}>수능 점수</div>
                <input type="number" value={form.suneung_score} onChange={e=>setForm(f=>({...f,suneung_score:e.target.value}))} placeholder="예: 280"
                  style={{width:"100%",padding:"8px 10px",border:`1px solid ${C.light}`,borderRadius:8,fontSize:13,color:C.charcoal,outline:"none"}}/>
              </div>
              <div style={{flex:1}}><div style={{fontSize:11,color:C.warm,marginBottom:2}}>내신 등급</div>
                <input type="number" step="0.1" min="1" max="9" value={form.naesin_grade} onChange={e=>setForm(f=>({...f,naesin_grade:e.target.value}))} placeholder="예: 3.2"
                  style={{width:"100%",padding:"8px 10px",border:`1px solid ${C.light}`,borderRadius:8,fontSize:13,color:C.charcoal,outline:"none"}}/>
              </div>
            </div>
            <div><div style={{fontSize:11,color:C.warm,marginBottom:2}}>희망 대학 (쉼표 구분)</div>
              <input value={form.target_schools} onChange={e=>setForm(f=>({...f,target_schools:e.target.value}))} placeholder="홍익대, 서울대, 이화여대"
                style={{width:"100%",padding:"8px 10px",border:`1px solid ${C.light}`,borderRadius:8,fontSize:13,color:C.charcoal,outline:"none"}}/>
            </div>
            <div><div style={{fontSize:11,color:C.warm,marginBottom:2}}>메모</div>
              <textarea value={form.memo} onChange={e=>setForm(f=>({...f,memo:e.target.value}))} rows={2} placeholder="특이사항"
                style={{width:"100%",padding:"8px 10px",border:`1px solid ${C.light}`,borderRadius:8,fontSize:13,color:C.charcoal,outline:"none",resize:"none",fontFamily:"inherit"}}/>
            </div>
            <button onClick={handleSave} disabled={saving} style={{padding:"10px 0",borderRadius:10,background:C.terra,color:"white",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              {saving?"저장 중...":"저장"}
            </button>
          </div>
        </Card>
      )}
      {scores.length === 0 && !showForm && (
        <div style={{textAlign:"center",padding:"30px 0",color:C.warm,fontSize:13}}>아직 기록이 없습니다</div>
      )}
      {scores.map(sc=>(
        <Card key={sc.id}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>{sc.exam_date}</div>
            <button onClick={()=>handleDelete(sc.id)} style={{background:"none",border:"none",color:C.warm,cursor:"pointer",fontSize:12}}>삭제</button>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
            {PRACTICAL_KEYS.map(k=>(sc.practical_scores?.[k]!=null&&(
              <span key={k} style={{fontSize:11,color:C.warm}}>{k}<span style={{fontWeight:700,color:C.terra,marginLeft:3}}>{sc.practical_scores[k]}</span></span>
            )))}
            {sc.suneung_score&&<span style={{fontSize:11,color:C.warm}}>수능<span style={{fontWeight:700,color:C.blue,marginLeft:3}}>{sc.suneung_score}</span></span>}
            {sc.naesin_grade&&<span style={{fontSize:11,color:C.warm}}>내신<span style={{fontWeight:700,color:C.sage,marginLeft:3}}>{sc.naesin_grade}</span></span>}
          </div>
          {sc.target_schools?.length>0&&<div style={{fontSize:11,color:C.warm,marginTop:4}}>🎓 {sc.target_schools.join(", ")}</div>}
          {sc.memo&&<div style={{fontSize:12,color:C.charcoal,marginTop:4,lineHeight:1.5}}>{sc.memo}</div>}
        </Card>
      ))}
    </div>
  );
};

// ─── ConsultationDiary ─────────────────────────────────────────
const ConsultationDiary = ({ student, academyId }) => {
  const [consultations, setConsultations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ consult_date:"", content:"" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  const load = useCallback(async () => {
    if (!academyId || !student?.id) return;
    let sb; try { sb = requireSupabase(); } catch { return; }
    const { data } = await sb.from("consultations").select("*")
      .eq("academy_id", academyId).eq("student_id", student.id)
      .order("consult_date", { ascending: false });
    if (data) setConsultations(data);
  }, [academyId, student?.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.consult_date || !form.content.trim()) { showAlert("날짜와 내용을 입력하세요"); return; }
    setSaving(true);
    try {
      const sb = requireSupabase();
      if (editId) {
        await sb.from("consultations").update({ consult_date:form.consult_date, content:form.content }).eq("id", editId);
      } else {
        await sb.from("consultations").insert({ academy_id:academyId, student_id:student.id, consult_date:form.consult_date, content:form.content });
      }
      setShowForm(false); setEditId(null);
      setForm({ consult_date:"", content:"" });
      await load();
    } catch(e) { showAlert("저장 실패: " + e.message); }
    setSaving(false);
  };
  const handleDelete = async (id) => {
    if (!window.confirm("이 상담 일지를 삭제할까요?")) return;
    try {
      const sb = requireSupabase();
      await sb.from("consultations").delete().eq("id", id);
      setConsultations(prev => prev.filter(c => c.id !== id));
    } catch(e) { showAlert("삭제 실패: " + e.message); }
  };
  const startEdit = (c) => {
    setForm({ consult_date:c.consult_date, content:c.content });
    setEditId(c.id);
    setShowForm(true);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0"}}>
        <span style={{fontSize:14}}>🔒</span>
        <span style={{fontSize:12,color:C.warm}}>비공개 상담 일지 — 원장님만 볼 수 있습니다</span>
      </div>
      <button onClick={()=>{setShowForm(!showForm);setEditId(null);setForm({consult_date:"",content:""});}} style={{padding:"10px 0",borderRadius:12,background:C.terra,color:"white",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>
        {showForm&&!editId?"취소":"+ 상담 일지 작성"}
      </button>
      {showForm && (
        <Card>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div><div style={{fontSize:11,color:C.warm,marginBottom:2}}>상담 날짜</div>
              <input type="date" value={form.consult_date} onChange={e=>setForm(f=>({...f,consult_date:e.target.value}))}
                style={{width:"100%",padding:"8px 10px",border:`1px solid ${C.light}`,borderRadius:8,fontSize:13,color:C.charcoal,outline:"none"}}/>
            </div>
            <div><div style={{fontSize:11,color:C.warm,marginBottom:2}}>상담 내용</div>
              <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={5} placeholder="상담 내용을 기록하세요..."
                style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.light}`,borderRadius:8,fontSize:13,color:C.charcoal,outline:"none",resize:"none",lineHeight:1.6,fontFamily:"inherit"}}/>
            </div>
            <button onClick={handleSave} disabled={saving} style={{padding:"10px 0",borderRadius:10,background:C.terra,color:"white",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              {saving?"저장 중...":(editId?"수정 저장":"저장")}
            </button>
          </div>
        </Card>
      )}
      {consultations.length === 0 && !showForm && (
        <div style={{textAlign:"center",padding:"30px 0",color:C.warm,fontSize:13}}>아직 상담 일지가 없습니다</div>
      )}
      {consultations.map(c=>(
        <Card key={c.id} style={{borderLeft:`3px solid ${C.terra}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11}}>🔒</span>
              <span style={{fontSize:13,fontWeight:700,color:C.charcoal}}>{c.consult_date}</span>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>startEdit(c)} style={{background:"none",border:"none",color:C.warm,cursor:"pointer",fontSize:12}}>수정</button>
              <button onClick={()=>handleDelete(c.id)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:12}}>삭제</button>
            </div>
          </div>
          <div style={{fontSize:13,color:C.charcoal,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{c.content}</div>
        </Card>
      ))}
    </div>
  );
};

const StudentDetail=({student,feedbacks,artworks,academy,attendanceRecords=[],onBack,onFeedback,onManualFeedback,onEdit,onUpdateFeedback,onDeleteFeedback,plan,onUpgrade,academyId,adminId})=>{
  const[tab,setTab]=useState("info");
  const[editFb,setEditFb]=useState(null);
  const[editContent,setEditContent]=useState("");
  const arts=artworks.filter(a=>a.studentId===student.id);
  const fbs=sortFeedbacksRecentFirst(feedbacksForStudent(feedbacks, student));
  const attendance=useMemo(
    ()=>studentAttendanceSummary(student.id, attendanceRecords),
    [student.id, attendanceRecords]
  );
  const attendStats=[
    {l:"출석",v:attendance.present,c:C.sage},
    {l:"지각",v:attendance.late,c:C.gold},
    {l:"결석",v:attendance.absent,c:C.red},
  ];
  const attendHistory=useMemo(
    ()=>attendance.rows.map(formatAttendanceHistoryRow),
    [attendance.rows]
  );
  const planOrder = { free:0, standard:1, premium:2 };
  const hasPremium = (planOrder[plan]??0) >= 2;
  const tabs=[
    {id:"info",l:"기본정보"},
    {id:"artworks",l:`작품 ${arts.length}`},
    {id:"attendance",l:"출결"},
    {id:"feedback",l:"피드백"},
    {id:"exam",l:"🎯 입시"},
    {id:"consult",l:"🔒 상담"},
  ];
  return(
    <div>
      <div style={{background:`linear-gradient(160deg,${C.beige},${C.cream})`,padding:"16px 16px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <BackBtn onClick={onBack}/>
          <button onClick={onEdit} style={{padding:"6px 14px",borderRadius:20,background:C.terra,color:"white",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",marginBottom:16}}>✏️ 정보 수정</button>
        </div>
        <div style={{display:"flex",gap:16,alignItems:"center"}}>
          <StudentAvatar student={student} size={70} fontSize={36} style={{background:"white",boxShadow:"0 4px 16px rgba(0,0,0,0.1)"}}/>
          <div>
            <div style={{fontSize:22,fontWeight:800,color:C.charcoal}}>{student.name}</div>
            <div style={{fontSize:13,color:C.warm,marginBottom:6}}>{student.school} · {student.grade}</div>
            <div style={{display:"flex",gap:6}}>{student.tags.map(t=><Badge key={t} small>{t}</Badge>)}</div>
          </div>
        </div>
      </div>
      <div style={{display:"flex",background:C.white,borderBottom:`1px solid ${C.beige}`}}>
        {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"12px 0",border:"none",background:"none",fontSize:12,fontWeight:tab===t.id?700:400,color:tab===t.id?C.terra:C.warm,borderBottom:`2px solid ${tab===t.id?C.terra:"transparent"}`,cursor:"pointer"}}>{t.l}</button>)}
      </div>
      <div style={{padding:16}}>
        {tab==="info"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>{[["성별",genderLabel(student.gender)],["학부",deptLabel(getDept(student.grade))],["수업 시간",student.classTime??"15:00"],["수업 요일",(student.classDay??[]).map(dayName).join(", ")],["학생 연락처",student.phone||"-"],["학부모 연락처",student.parentPhone||student.phone||"-"],["등록일",student.enroll],["결제일",`매월 ${student.feeDueDay}일`],["월 수강료",fmtMoney(student.monthlyFee)],["결제 현황",student.fee]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.beige}`}}>
                <span style={{fontSize:13,color:C.warm}}>{k}</span><span style={{fontSize:13,fontWeight:600,color:C.charcoal}}>{v}</span>
              </div>
            ))}</Card>
            <Card>
              <div style={{fontSize:12,color:C.warm,marginBottom:8}}>이달 출석률</div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <div style={{fontSize:24,fontWeight:800,color:attendance.rate>=80?C.sage:C.gold}}>{attendance.rate}%</div>
                <div style={{flex:1}}><ProgressBar value={attendance.rate} color={attendance.rate>=80?C.sage:C.gold} h={8}/></div>
              </div>
              <div style={{display:"flex",gap:20}}>
                {attendStats.map(s=>(
                  <div key={s.l} style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:C.warm}}>{s.l}</div></div>
                ))}
              </div>
            </Card>
            <Card><div style={{fontSize:12,color:C.warm,marginBottom:6}}>상담 메모</div><div style={{fontSize:13,color:C.charcoal,lineHeight:1.7}}>{student.memo}</div></Card>
          </div>
        )}
        {tab==="artworks"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <PortfolioExportBtn student={student} artworks={artworks} academy={academy} feedbacks={feedbacks} style={{width:"100%"}} />
            {arts.length===0?<div style={{textAlign:"center",padding:"40px 0",color:C.warm}}>아직 작품이 없습니다</div>
            :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {arts.map(a=>(
                <Card key={a.id} style={{padding:0,overflow:"hidden"}}>
                  <ArtworkCover artwork={a} height={160} fontSize={48} />
                  <div style={{padding:"8px 10px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.charcoal}}>{a.title}</div>
                      {a.uploadedBy==="parent"&&<Badge small color="green">집에서 완성</Badge>}
                    </div>
                    <div style={{fontSize:10,color:C.warm,marginTop:2}}>{a.medium} · {a.date}</div>
                    <div style={{marginTop:6}}><ProgressBar value={a.progress} color={C.sage}/></div>
                  </div>
                </Card>
              ))}
            </div>}
          </div>
        )}
        {tab==="attendance"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Card>
              <div style={{fontSize:12,color:C.warm,marginBottom:10}}>이 학생의 출석부 Word</div>
              <AttendanceExportBtn student={student} attendanceRecords={attendanceRecords} academy={academy} compact/>
            </Card>
            <Card>
              <div style={{fontSize:12,color:C.warm,marginBottom:8}}>이달 출석 현황</div>
              <div style={{marginBottom:12}}><ProgressBar value={attendance.rate} color={C.sage} h={8}/></div>
              <div style={{display:"flex",gap:20}}>
                {attendStats.map(s=>(
                  <div key={s.l} style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:C.warm}}>{s.l}</div></div>
                ))}
              </div>
            </Card>
            {attendHistory.length===0
              ? <div style={{textAlign:"center",padding:"32px 0",color:C.warm,fontSize:13}}>이번 달 출결 기록이 없습니다</div>
              : attendHistory.map(item=>(
              <Card key={item.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,color:C.charcoal}}>{item.text}</span>
                <StatusChip s={item.status}/>
              </Card>
            ))}
          </div>
        )}
        {tab==="feedback"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <PlanGate requiredPlan="standard" plan={plan} onUpgrade={onUpgrade}>
              <button onClick={()=>onFeedback(student)} style={{width:"100%",padding:14,borderRadius:12,background:C.terra,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>✨ AI 피드백 자동 생성</button>
            </PlanGate>
            <button onClick={()=>onManualFeedback(student)} style={{width:"100%",padding:14,borderRadius:12,background:C.white,color:C.charcoal,border:`2px solid ${C.sand}`,fontSize:14,fontWeight:700,cursor:"pointer"}}>✏️ 피드백 직접 작성</button>
            {fbs.map(f=>(
              <FeedbackMessageRow
                key={f.id}
                feedback={f}
                onOpen={(item)=>{setEditFb(item);setEditContent(item.content);}}
                onEdit={()=>{setEditFb(f);setEditContent(f.content);}}
                onDelete={()=>{if(window.confirm("이 피드백을 삭제할까요?"))onDeleteFeedback(f.id);}}
              />
            ))}
          </div>
        )}
        {tab==="exam"&&(
          <PlanGate requiredPlan="premium" plan={plan} onUpgrade={onUpgrade}>
            <ExamScoreManager student={student} academyId={academyId}/>
          </PlanGate>
        )}
        {tab==="consult"&&(
          <PlanGate requiredPlan="premium" plan={plan} onUpgrade={onUpgrade}>
            <ConsultationDiary student={student} academyId={academyId}/>
          </PlanGate>
        )}
      </div>
      <BottomSheet open={!!editFb} onClose={()=>setEditFb(null)} title="피드백 수정">
        <textarea value={editContent} onChange={e=>setEditContent(e.target.value)} rows={5} style={{width:"100%",padding:"10px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:13,outline:"none",background:C.cream,color:C.charcoal,resize:"none",fontFamily:"inherit",marginBottom:14}}/>
        <button onClick={()=>{if(editContent.trim()){onUpdateFeedback(editFb.id,{content:editContent});setEditFb(null);}}} style={{width:"100%",padding:14,borderRadius:12,background:C.terra,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>저장</button>
      </BottomSheet>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 4. ARTWORKS + UPLOAD (3-step)
// ══════════════════════════════════════════════════════════════
const AdminArtworks=({artworks,students,onUpload,onBeforeAfter,onArtworkFeedback,onEditArtwork})=>{
  const[fs,setFs]=useState("all");
  const sf=useMemo(()=>[
    {id:"all",name:"전체"},
    ...(students??[]).map(s=>({id:s.id,name:s.name})),
  ],[students]);
  const list=fs==="all"?artworks:artworks.filter(a=>a.studentId===fs);
  return(
    <div style={{padding:"0 16px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0 12px",paddingRight:0}}>
        <div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>작품 아카이브</div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          <button onClick={onBeforeAfter} style={{background:C.beige,color:C.terra,border:`1px solid ${C.terraL}`,borderRadius:20,padding:"8px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>📊 성장비교</button>
          <button onClick={onUpload} style={{background:C.terra,color:"white",border:"none",borderRadius:20,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📸 업로드</button>
        </div>
      </div>
      {students.length>0&&(
        <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:16,paddingBottom:4}}>
          {sf.map(f=><button key={f.id} onClick={()=>setFs(f.id)} style={{flexShrink:0,padding:"6px 14px",borderRadius:20,border:fs===f.id?"none":`1px solid ${C.light}`,background:fs===f.id?C.terra:C.white,color:fs===f.id?"white":C.warm,fontSize:12,fontWeight:600,cursor:"pointer"}}>{f.name}</button>)}
        </div>
      )}
      <div style={{fontSize:12,fontWeight:700,color:C.warm,marginBottom:10}}>작품 {list.length}점</div>
      {list.length===0?(
        <div style={{textAlign:"center",padding:"48px 16px",color:C.warm,fontSize:13,lineHeight:1.7}}>
          등록된 작품이 없습니다.<br/>우측 상단 <strong>📸 업로드</strong>로 작품을 추가해 보세요.
        </div>
      ):(
      <div style={{columns:2,gap:10}}>
        {list.map((a,i)=>(
          <div key={a.id} style={{breakInside:"avoid",marginBottom:10}}>
            <Card style={{padding:0,overflow:"hidden"}} onClick={()=>onArtworkFeedback?.(a)}>
              <ArtworkCover artwork={a} height={i % 3 === 0 ? 160 : 120} fontSize={i % 3 === 0 ? 60 : 48} />
              <div style={{padding:"10px 12px 12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.charcoal}}>{a.title}</div>
                  {a.uploadedBy==="parent"&&<Badge small color="green">집</Badge>}
                </div>
                <div style={{fontSize:11,color:C.warm,margin:"3px 0"}}>{a.studentName}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                  <Badge small>{a.medium}</Badge>
                  <span style={{fontSize:10,color:C.warm}}>{a.date.slice(5)}</span>
                </div>
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  <button
                    type="button"
                    onClick={(e)=>{ e.stopPropagation(); onEditArtwork?.(a); }}
                    style={{flex:1,padding:"6px 8px",borderRadius:8,background:C.beige,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",color:C.charcoal}}
                  >
                    📷 사진 수정
                  </button>
                  <button
                    type="button"
                    onClick={(e)=>{ e.stopPropagation(); onArtworkFeedback?.(a); }}
                    style={{flex:1,padding:"6px 8px",borderRadius:8,background:C.terra,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",color:"white"}}
                  >
                    💬 피드백
                  </button>
                </div>
                {a.progress<100&&<div style={{marginTop:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,color:C.warm}}>진행률</span><span style={{fontSize:10,color:C.terra,fontWeight:600}}>{a.progress}%</span></div><ProgressBar value={a.progress} color={C.terra} h={3}/></div>}
              </div>
            </Card>
          </div>
        ))}
      </div>
      )}
    </div>
  );
};


// ══════════════════════════════════════════════════════════════
// BEFORE / AFTER SLIDER
// ══════════════════════════════════════════════════════════════
const BeforeAfterSlider=({
  beforeEmoji="🧍", afterEmoji="🌸",
  beforePhotoUri=null, afterPhotoUri=null,
  beforeTitle="자화상 스케치", afterTitle="봄꽃 수채화",
  beforeDate="2025-03-10", afterDate="2025-05-20",
})=>{
  const[pos,setPos]=useState(50);
  const[dragging,setDragging]=useState(false);
  const ref=useRef(null);

  const renderSide=(photoUri, emoji, title, date, align)=>{
    if(photoUri){
      return (
        <div style={{height:220,position:"relative",overflow:"hidden"}}>
          <img src={photoUri} alt={title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          <div style={{position:"absolute",bottom:8,[align]:12,fontSize:11,color:"rgba(61,53,48,0.85)",fontWeight:600,background:"rgba(255,255,255,0.75)",padding:"2px 8px",borderRadius:8}}>{title}<br/>{date}</div>
        </div>
      );
    }
    return (
      <div style={{background:`linear-gradient(135deg,${align==="left"?`${C.beige},${C.light}`:`${C.terraL},${C.sand}`})`,height:220,display:"flex",alignItems:"center",justifyContent:"center",fontSize:80,position:"relative"}}>
        {emoji}
        <div style={{position:"absolute",bottom:8,[align]:12,fontSize:11,color:"rgba(61,53,48,0.7)",fontWeight:600,background:"rgba(255,255,255,0.6)",padding:"2px 8px",borderRadius:8}}>{title}<br/>{date}</div>
      </div>
    );
  };

  const handleMove=(clientX)=>{
    if(!ref.current)return;
    const rect=ref.current.getBoundingClientRect();
    const p=Math.min(Math.max(((clientX-rect.left)/rect.width)*100,5),95);
    setPos(p);
  };
  const onMouseMove=useCallback((e)=>{if(dragging)handleMove(e.clientX);},[dragging]);
  const onTouchMove=useCallback((e)=>{if(dragging)handleMove(e.touches[0].clientX);},[dragging]);

  return(
    <div>
      <div style={{fontSize:13,color:C.warm,marginBottom:10,textAlign:"center"}}>← 슬라이더를 드래그하세요 →</div>
      <div ref={ref}
        style={{position:"relative",borderRadius:16,overflow:"hidden",userSelect:"none",cursor:"col-resize",touchAction:"none"}}
        onMouseMove={onMouseMove} onMouseUp={()=>setDragging(false)} onMouseLeave={()=>setDragging(false)}
        onTouchMove={onTouchMove} onTouchEnd={()=>setDragging(false)}
      >
        {/* AFTER (full width base) */}
        {renderSide(afterPhotoUri, afterEmoji, afterTitle, afterDate, "right")}

        {/* BEFORE (clipped overlay) */}
        <div style={{position:"absolute",inset:0,width:`${pos}%`,overflow:"hidden"}}>
          <div style={{width:`${100/pos*100}%`}}>
            {renderSide(beforePhotoUri, beforeEmoji, beforeTitle, beforeDate, "left")}
          </div>
        </div>

        {/* Divider line + handle */}
        <div style={{position:"absolute",top:0,bottom:0,left:`${pos}%`,transform:"translateX(-50%)",width:3,background:"white",boxShadow:"0 0 8px rgba(0,0,0,0.3)",zIndex:10}}
          onMouseDown={()=>setDragging(true)} onTouchStart={()=>setDragging(true)}
        >
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:32,height:32,borderRadius:16,background:"white",boxShadow:"0 2px 12px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,cursor:"col-resize"}}>⇔</div>
        </div>

        {/* Labels */}
        <div style={{position:"absolute",top:10,left:10,background:"rgba(0,0,0,0.45)",color:"white",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:6}}>BEFORE</div>
        <div style={{position:"absolute",top:10,right:10,background:`rgba(193,127,91,0.85)`,color:"white",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:6}}>AFTER</div>
      </div>
    </div>
  );
};

const BeforeAfterPage=({onBack, students=[], artworks=[]})=>{
  const pairs=useMemo(()=>buildGrowthPairs(students, artworks),[students, artworks]);
  const[sel,setSel]=useState(null);
  useEffect(()=>{ setSel(pairs[0] ?? null); }, [pairs]);

  if(!pairs.length){
    return (
      <div style={{padding:"0 16px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 0"}}>
          <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.warm}}>←</button>
          <div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>성장 비교 Before/After</div>
        </div>
        <Card style={{textAlign:"center",padding:"48px 20px",color:C.warm}}>
          비교할 작품이 2점 이상인 학생이 없습니다.<br/>작품을 등록하면 성장 비교를 볼 수 있습니다.
        </Card>
      </div>
    );
  }

  if(!sel) return null;

  const timelineItems=[
    {date:sel.beforeDate,emoji:sel.beforeEmoji,photoUri:sel.beforePhotoUri,title:sel.beforeTitle,tag:"시작"},
    ...(sel.timelineArts?.length > 2
      ? sel.timelineArts.slice(1, -1).map((art)=>({
          date:art.date, emoji:art.emoji, photoUri:art.photoUri, title:art.title, tag:"발전",
        }))
      : []),
    {date:sel.afterDate,emoji:sel.afterEmoji,photoUri:sel.afterPhotoUri,title:sel.afterTitle,tag:"현재"},
  ];

  return(
    <div style={{padding:"0 16px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 0"}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.warm}}>←</button>
        <div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>성장 비교 Before/After</div>
      </div>

      {/* Student selector */}
      <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:16,paddingBottom:4}}>
        {pairs.map(p=>(
          <button key={p.id} onClick={()=>setSel(p)} style={{flexShrink:0,padding:"6px 14px",borderRadius:20,background:sel.id===p.id?C.terra:C.beige,color:sel.id===p.id?"white":C.warm,border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>{p.studentName}</button>
        ))}
      </div>

      {/* Slider */}
      <Card style={{padding:0,overflow:"hidden",marginBottom:16}}>
        <BeforeAfterSlider {...sel}/>
        <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:20}}>📈</span>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>{sel.studentName}의 성장</div>
            <div style={{fontSize:12,color:C.terra,fontWeight:600,marginTop:2}}>{sel.growth}</div>
          </div>
        </div>
      </Card>

      {/* Growth timeline */}
      <SecTitle>성장 타임라인</SecTitle>
      <div style={{display:"flex",flexDirection:"column",gap:0}}>
        {timelineItems.map((item,i,arr)=>(
          <div key={`${item.date}-${item.title}-${i}`} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div style={{width:32,height:32,borderRadius:16,background:i===arr.length-1?C.terra:C.beige,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,overflow:"hidden"}}>
                {item.photoUri
                  ? <img src={item.photoUri} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : item.emoji}
              </div>
              {i<arr.length-1&&<div style={{width:2,height:28,background:C.light,margin:"4px 0"}}/>}
            </div>
            <div style={{paddingTop:4,paddingBottom:16}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:2}}>
                <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>{item.title}</div>
                <Badge small color={i===arr.length-1?"terra":"beige"}>{item.tag}</Badge>
              </div>
              <div style={{fontSize:11,color:C.warm}}>{item.date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const UploadModal=({onClose,onSave,students,presetStudent=null,parentMode=false})=>{
  const[step,setStep]=useState(1);
  const[selS,setSelS]=useState(presetStudent);
  const[selE,setSelE]=useState(null);
  const[title,setTitle]=useState("");
  const[rawPhotoUri,setRawPhotoUri]=useState(null);
  const[photoUri,setPhotoUri]=useState(null);
  const[loading,setLoading]=useState(false);
  const fileInputRef=useRef(null);
  const emojis=["🌸","🦋","🌊","🏔️","🌻","🎭","🌈","🦚","🎨","🌺"];
  const studentList=presetStudent?[presetStudent]:(students??STUDENTS);
  const fixedStudent=!!presetStudent;

  const afterPhotoPick=(uri)=>{
    setRawPhotoUri(uri);
    setPhotoUri(uri);
    if(!selE)setSelE("🎨");
    setStep(2);
  };

  const pickNative=async(type)=>{
    if(!window.ArtlogNative?.isNative)return false;
    setLoading(true);
    try{
      const result=type==="camera"
        ? await window.ArtlogNative.openCamera()
        : await window.ArtlogNative.openGallery();
      if(result?.uri) afterPhotoPick(result.uri);
      return true;
    }catch(e){
      showAlert(e.message||"사진 선택에 실패했습니다.");
      return true;
    }finally{
      setLoading(false);
    }
  };

  const openCamera=async()=>{
    if(await pickNative("camera"))return;
    fileInputRef.current?.click();
  };

  const openGallery=async()=>{
    if(await pickNative("gallery"))return;
    fileInputRef.current?.click();
  };

  const handleFilePick=e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    if(!file.type.startsWith("image/")){
      showAlert("이미지 파일을 선택해 주세요.");
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>afterPhotoPick(reader.result);
    reader.readAsDataURL(file);
    e.target.value="";
  };

  const goNextFromSelect=()=>{
    if(photoUri)setStep(2);
    else if(selE)setStep(3);
  };

  return(
    <BottomSheet open onClose={onClose} title={parentMode?"집에서 완성한 작품 올리기":"작품 업로드"}>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleFilePick}/>
      <div style={{display:"flex",gap:6,marginBottom:20,justifyContent:"center"}}>
        {(photoUri?[1,2,3,4]:[1,3,4]).map((s,i)=>(
          <div key={s} style={{width:(photoUri?s===step:s===step||(s===3&&step>=3))?24:8,height:8,borderRadius:4,background:(photoUri?s<=step:s===1||s===3&&step>=3)?C.terra:C.light,transition:"all .3s"}}/>
        ))}
      </div>
      {step===1&&(
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.charcoal,marginBottom:4}}>① 사진 선택</div>
          <div style={{fontSize:13,color:C.warm,marginBottom:16}}>{parentMode?"집에서 완성한 작품 사진을 올려 주세요":"촬영·갤러리 또는 이모지로 등록하세요"}</div>
          {fixedStudent&&(
            <div style={{display:"flex",alignItems:"center",gap:10,padding:12,background:C.beige,borderRadius:12,marginBottom:12}}>
              <span style={{fontSize:26}}>{presetStudent.art}</span>
              <div><div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{presetStudent.name}</div><div style={{fontSize:11,color:C.warm}}>{presetStudent.grade}</div></div>
            </div>
          )}
          {photoUri&&<img src={photoUri} alt="preview" style={{width:"100%",height:140,objectFit:"cover",borderRadius:12,marginBottom:12}}/>}
          {!parentMode&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:20}}>
              {emojis.map(e=><div key={e} onClick={()=>{setSelE(e);setRawPhotoUri(null);setPhotoUri(null);}} style={{aspectRatio:"1",borderRadius:10,background:selE===e&&!photoUri?"#FFF0E6":C.cream,border:`2px solid ${selE===e&&!photoUri?C.terra:"transparent"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,cursor:"pointer"}}>{e}</div>)}
            </div>
          )}
          <div style={{display:"flex",gap:10,marginBottom:10}}>
            <button onClick={openCamera} disabled={loading} style={{flex:1,padding:14,borderRadius:12,background:C.beige,border:"none",fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",color:C.charcoal}}>{loading?"…":"📷 카메라"}</button>
            <button onClick={openGallery} disabled={loading} style={{flex:1,padding:14,borderRadius:12,background:C.beige,border:"none",fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",color:C.charcoal}}>{loading?"…":"🖼 갤러리"}</button>
          </div>
          <button onClick={goNextFromSelect} style={{width:"100%",padding:14,borderRadius:12,background:(parentMode?photoUri:(selE||photoUri))?C.terra:C.light,border:"none",fontSize:14,fontWeight:700,cursor:(parentMode?photoUri:(selE||photoUri))?"pointer":"not-allowed",color:"white"}}>다음 →</button>
        </div>
      )}
      {step===2&&rawPhotoUri&&(
        <ImageCropEditor
          src={rawPhotoUri}
          title="② 사진 자르기"
          onApply={uri=>{ setPhotoUri(uri); setStep(3); }}
          onSkip={()=>{ setPhotoUri(rawPhotoUri); setStep(3); }}
          onCancel={()=>{ setRawPhotoUri(null); setPhotoUri(null); setStep(1); }}
        />
      )}
      {step===3&&(
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.charcoal,marginBottom:4}}>{photoUri?"③":"②"} {fixedStudent?"작품 정보":"학생 선택"}</div>
          {photoUri&&<img src={photoUri} alt="preview" style={{width:"100%",height:120,objectFit:"cover",borderRadius:12,marginBottom:12}}/>}
          {!photoUri&&selE&&<div style={{textAlign:"center",fontSize:48,marginBottom:12}}>{selE}</div>}
          {fixedStudent?(
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:12,padding:12,borderRadius:12,background:"#FFF5EE",border:`2px solid ${C.terra}`,marginBottom:12}}>
                <span style={{fontSize:26}}>{presetStudent.art}</span>
                <div><div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{presetStudent.name}</div><div style={{fontSize:11,color:C.warm}}>{presetStudent.school} {presetStudent.grade}</div></div>
              </div>
              <div style={{fontSize:11,color:C.warm,marginBottom:4}}>작품 제목 (선택)</div>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 봄꽃 수채화 완성"
                style={{width:"100%",padding:"12px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:14,outline:"none",background:C.cream,color:C.charcoal}}/>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20,maxHeight:260,overflowY:"auto"}}>
              {studentList.map(s=>(
                <div key={s.id} onClick={()=>setSelS(s)} style={{display:"flex",alignItems:"center",gap:12,padding:12,borderRadius:12,border:`2px solid ${selS?.id===s.id?C.terra:"transparent"}`,background:selS?.id===s.id?"#FFF5EE":C.beige,cursor:"pointer"}}>
                  <span style={{fontSize:26}}>{s.art}</span>
                  <div><div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{s.name}</div><div style={{fontSize:11,color:C.warm}}>{s.school} {s.grade}</div></div>
                  {selS?.id===s.id&&<span style={{marginLeft:"auto",color:C.terra,fontWeight:700}}>✓</span>}
                </div>
              ))}
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setStep(photoUri?2:1)} style={{flex:1,padding:14,borderRadius:12,background:C.beige,border:"none",fontSize:14,cursor:"pointer",color:C.charcoal}}>← 이전</button>
            <button onClick={()=>{
              const student=fixedStudent?presetStudent:selS;
              if(!student)return;
              onSave?.({ student, emoji: selE || "🎨", photoUri, title: title.trim(), parentMode });
              setStep(4);
            }} style={{flex:2,padding:14,borderRadius:12,background:(fixedStudent||selS)?C.terra:C.light,border:"none",fontSize:14,fontWeight:700,cursor:(fixedStudent||selS)?"pointer":"not-allowed",color:"white"}}>저장하기</button>
          </div>
        </div>
      )}
      {step===4&&(
        <div style={{textAlign:"center",padding:"20px 0"}}>
          <div style={{fontSize:60,marginBottom:12}}>🎉</div>
          <div style={{fontSize:18,fontWeight:800,color:C.charcoal,marginBottom:8}}>업로드 완료!</div>
          <div style={{fontSize:13,color:C.warm,marginBottom:24,lineHeight:1.7}}>{(fixedStudent?presetStudent:selS)?.name}의 작품 {photoUri?"사진":"이 등록"}<br/>{parentMode?"원장님 작품함에 전달되었습니다":"아카이브에 저장되었습니다"}</div>
          <button onClick={onClose} style={{width:"100%",padding:14,borderRadius:12,background:C.terra,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>확인</button>
        </div>
      )}
    </BottomSheet>
  );
};

const ArtworkPhotoEditModal = ({ artwork, onClose, onSave }) => {
  const [photoUri, setPhotoUri] = useState(artwork?.photoUri ?? null);
  const [rawPhotoUri, setRawPhotoUri] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const afterPhotoPick = (uri) => {
    setRawPhotoUri(uri);
    setPhotoUri(uri);
    setStep(2);
  };

  const pickNative = async (type) => {
    if (!window.ArtlogNative?.isNative) return false;
    setLoading(true);
    try {
      const result = type === "camera"
        ? await window.ArtlogNative.openCamera()
        : await window.ArtlogNative.openGallery();
      if (result?.uri) afterPhotoPick(result.uri);
      return true;
    } catch (e) {
      showAlert(e.message || "사진 선택에 실패했습니다.");
      return true;
    } finally {
      setLoading(false);
    }
  };

  const openCamera = async () => {
    if (await pickNative("camera")) return;
    fileInputRef.current?.click();
  };

  const openGallery = async () => {
    if (await pickNative("gallery")) return;
    fileInputRef.current?.click();
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showAlert("이미지 파일을 선택해 주세요.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => afterPhotoPick(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!photoUri) {
      showAlert("변경할 사진을 선택해 주세요.");
      return;
    }
    setSaving(true);
    try {
      await onSave?.(photoUri);
      onClose?.();
    } catch (e) {
      showAlert(e?.message || "사진 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!artwork) return null;

  return (
    <BottomSheet open onClose={onClose} title="작품 사진 수정">
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFilePick} />
      <div style={{ fontSize: 13, color: C.warm, marginBottom: 12 }}>
        {artwork.studentName} · {artwork.title}
      </div>
      {step === 1 && (
        <div>
          <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
            <ArtworkCover artwork={{ ...artwork, photoUri }} height={180} fontSize={64} />
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <button onClick={openCamera} disabled={loading} style={{ flex: 1, padding: 14, borderRadius: 12, background: C.beige, border: "none", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", color: C.charcoal }}>
              {loading ? "…" : "📷 카메라"}
            </button>
            <button onClick={openGallery} disabled={loading} style={{ flex: 1, padding: 14, borderRadius: 12, background: C.beige, border: "none", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", color: C.charcoal }}>
              {loading ? "…" : "🖼 갤러리"}
            </button>
          </div>
          <button onClick={handleSave} disabled={saving || !photoUri || photoUri === artwork.photoUri} style={{ width: "100%", padding: 14, borderRadius: 12, background: saving || !photoUri || photoUri === artwork.photoUri ? C.light : C.terra, color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: saving || !photoUri || photoUri === artwork.photoUri ? "not-allowed" : "pointer" }}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      )}
      {step === 2 && rawPhotoUri && (
        <ImageCropEditor
          src={rawPhotoUri}
          title="사진 자르기"
          onApply={(uri) => { setPhotoUri(uri); setStep(1); }}
          onSkip={() => { setPhotoUri(rawPhotoUri); setStep(1); }}
          onCancel={() => { setRawPhotoUri(null); setPhotoUri(artwork.photoUri ?? null); setStep(1); }}
        />
      )}
    </BottomSheet>
  );
};

// ══════════════════════════════════════════════════════════════
// 5. PAYMENTS
// ══════════════════════════════════════════════════════════════
const AdminPayments=({students,onUpdateStudent,linkedParents,onSendUnpaidReminder,onBack})=>{
  const now=new Date();
  const currentMonthKey=getCalendarMonthKey(now);
  const monthOptions=useMemo(()=>recentMonthKeys(3, now),[]);
  const[month,setMonth]=useState(()=>monthOptions[0]);
  const[payModal,setPayModal]=useState(null);
  const[payStatus,setPayStatus]=useState("미납");
  const[payMethod,setPayMethod]=useState(null);
  const[saving,setSaving]=useState(false);
  const[sendingReminder,setSendingReminder]=useState(false);
  const rev=useMemo(()=>monthRevenueTotal(students, month),[students, month]);
  const paidCount=useMemo(()=>students.filter(s=>isPaidForMonth(s, month)).length,[students, month]);
  const methodLabels={cash:"현금",transfer:"이체",card:"카드"};
  const methodReverse={현금:"cash",이체:"transfer",카드:"card"};

  const payModalStudent=payModal?students.find(s=>s.id===payModal.id)??payModal:null;
  const modalMonthPayment=payModalStudent?getMonthPayment(payModalStudent, month):null;
  const modalMonthPaid=!!modalMonthPayment;
  const isCurrentMonthTab=month===currentMonthKey;

  const openPayModal=(student)=>{
    const payment=getMonthPayment(student, month);
    const paid=!!payment;
    setPayModal(student);
    setPayStatus(paid?"납부완료":"미납");
    setPayMethod(payment?.method?methodReverse[payment.method]??null:null);
  };

  const savePaymentStatus=async()=>{
    if(!payModalStudent)return;
    if(payStatus==="납부완료"&&!payMethod)return;
    if(modalMonthPaid&&payStatus==="미납"){
      if(!window.confirm(`${payModalStudent.name} 학생의 ${formatMonthTabLabel(month)} 납부를 미납으로 변경할까요?`))return;
    }
    setSaving(true);
    try{
      const methodLabel=payMethod?methodLabels[payMethod]:"";
      const payDate=payStatus==="납부완료"
        ?(month===currentMonthKey?new Date().toISOString().slice(0,10):paymentDateForMonth(month, payModalStudent.feeDueDay))
        :null;
      const feePayments=payStatus==="납부완료"
        ?upsertMonthPayment(payModalStudent.feePayments, month, { date: payDate, method: methodLabel })
        :removeMonthPayment(payModalStudent.feePayments, month);
      const syncFields=syncCurrentMonthFeeFields(feePayments, month, payStatus, methodLabel, payDate);
      await onUpdateStudent(payModalStudent.id,{ feePayments, ...syncFields });
      setPayModal(null);
      setPayMethod(null);
    }catch(e){
      showAlert("저장 실패: " + e.message);
    }finally{
      setSaving(false);
    }
  };

  const sendUnpaidReminder=async()=>{
    if(!payModalStudent||!isCurrentMonthTab||modalMonthPaid)return;
    setSendingReminder(true);
    try{
      const ok=await onSendUnpaidReminder(payModalStudent);
      if(ok) showAlert(`${payModalStudent.name} 학부모에게 미납 공지를 등록했습니다. 학부모 앱에서 공지·알림으로 전달됩니다.`);
    }catch(e){
      showAlert("미납 공지 발송 실패: " + e.message);
    }finally{
      setSendingReminder(false);
    }
  };

  const isUnpaid=payStatus==="미납";
  const hasLinkedParent=payModalStudent&&linkedParents.some(p=>String(p.studentId)===String(payModalStudent.id));
  const statusChanged=payModalStudent&&(
    (payStatus==="납부완료"&&!modalMonthPaid)||
    (payStatus==="미납"&&modalMonthPaid)||
    (payStatus==="납부완료"&&modalMonthPaid&&payMethod&&methodLabels[payMethod]!==modalMonthPayment?.method)
  );

  return(
    <div style={{padding:"0 16px 16px"}}>
      {onBack&&<BackBtn onClick={onBack}/>}
      <div style={{fontSize:18,fontWeight:800,color:C.charcoal,padding:onBack?"0 0 16px":"16px 0"}}>수강료 관리</div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {monthOptions.map(m=><button key={m} onClick={()=>setMonth(m)} style={{padding:"8px 14px",borderRadius:20,background:month===m?C.terra:C.beige,color:month===m?"white":C.warm,border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>{formatMonthTabLabel(m)}</button>)}
      </div>
      <Card style={{background:`linear-gradient(135deg,${C.terra},${C.terraD})`,marginBottom:16}}>
        <div style={{color:"rgba(255,255,255,0.8)",fontSize:12,marginBottom:4}}>{formatMonthTabLabel(month)} 총 매출</div>
        <div style={{color:"white",fontSize:28,fontWeight:800}}>{fmtMoney(rev)}</div>
        <div style={{color:"rgba(255,255,255,0.7)",fontSize:12,marginTop:4}}>납부 {paidCount}명 / 전체 {students.length}명</div>
      </Card>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {students.map(s=>{
          const payment=getMonthPayment(s, month);
          const paid=!!payment;
          const badgeLabel=paid?"납부완료":"미납";
          return(
            <Card key={s.id} style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:26}}>{s.art}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{s.name}</div>
                <div style={{fontSize:12,color:C.warm}}>{fmtMoney(s.monthlyFee)} · 매월 {s.feeDueDay}일{payment?.method?` · ${payment.method}`:""}{payment?.date?` · ${payment.date}`:""}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                <Badge color={paid?"green":"red"}>{badgeLabel}</Badge>
                <button onClick={()=>openPayModal(s)} style={{padding:"4px 10px",borderRadius:8,background:paid?C.beige:C.terra,color:paid?C.charcoal:"white",border:paid?`1px solid ${C.light}`:"none",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                  {paid?"상태 수정":"결제 확인"}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      <BottomSheet open={!!payModal} onClose={()=>{setPayModal(null);setPayMethod(null);}} title={`${formatMonthTabLabel(month)} 납부 상태`}>
        {payModalStudent&&(
          <>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16,padding:12,background:C.beige,borderRadius:12}}>
              <span style={{fontSize:28}}>{payModalStudent.art}</span>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.charcoal}}>{payModalStudent.name}</div>
                <div style={{fontSize:13,color:C.warm}}>{fmtMoney(payModalStudent.monthlyFee)} · 매월 {payModalStudent.feeDueDay}일</div>
                <div style={{fontSize:11,color:C.warm,marginTop:4}}>{formatMonthTabLabel(month)}: <strong style={{color:C.charcoal}}>{modalMonthPaid?"납부완료":"미납"}</strong>{modalMonthPayment?.date?` · ${modalMonthPayment.date}`:""}</div>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:C.warm,marginBottom:8}}>납부 상태</div>
              <div style={{display:"flex",gap:8}}>
                {[{id:"미납",l:"미납",c:C.red},{id:"납부완료",l:"납부완료",c:C.sage}].map(opt=>(
                  <button
                    key={opt.id}
                    type="button"
                    onClick={()=>{
                      setPayStatus(opt.id);
                      if(opt.id==="미납") setPayMethod(null);
                    }}
                    style={{
                      flex:1,padding:12,borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",
                      background:payStatus===opt.id?`${opt.c}18`:C.beige,
                      border:`2px solid ${payStatus===opt.id?opt.c:"transparent"}`,
                      color:payStatus===opt.id?opt.c:C.charcoal,
                    }}
                  >{opt.l}</button>
                ))}
              </div>
            </div>
            {payStatus==="납부완료"&&(
              <div style={{marginBottom:12}}>
                <div style={{fontSize:12,color:C.warm,marginBottom:8}}>결제 방법</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[{id:"cash",l:"💵 현금"},{id:"transfer",l:"🏦 이체"},{id:"card",l:"💳 카드"}].map(m=>(
                    <button
                      key={m.id}
                      type="button"
                      onClick={()=>setPayMethod(m.id)}
                      style={{
                        padding:12,borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",
                        background:payMethod===m.id?"#FFF0E6":C.beige,
                        border:`2px solid ${payMethod===m.id?C.terra:"transparent"}`,
                        color:payMethod===m.id?C.terra:C.charcoal,
                      }}
                    >{m.l}</button>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={savePaymentStatus}
              disabled={saving||(payStatus==="납부완료"&&!payMethod)||!statusChanged}
              style={{width:"100%",padding:14,borderRadius:12,background:!saving&&(payStatus==="미납"||payMethod)&&statusChanged?C.terra:C.light,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:!saving&&(payStatus==="미납"||payMethod)&&statusChanged?"pointer":"not-allowed",marginBottom:isUnpaid?10:0}}
            >{saving?"저장 중…":payStatus==="납부완료"?"✅ 납부 완료로 저장":"↩ 미납으로 저장"}</button>
            {isUnpaid&&isCurrentMonthTab&&!modalMonthPaid&&(
              <>
                <button
                  onClick={sendUnpaidReminder}
                  disabled={sendingReminder||!hasLinkedParent}
                  style={{width:"100%",padding:14,borderRadius:12,background:hasLinkedParent?"#FFF0E6":C.beige,color:hasLinkedParent?C.terra:C.warm,border:`1px solid ${hasLinkedParent?C.terraL:C.light}`,fontSize:14,fontWeight:700,cursor:hasLinkedParent&&!sendingReminder?"pointer":"not-allowed"}}
                >{sendingReminder?"발송 중…":"📢 미납 알림 보내기"}</button>
                {!hasLinkedParent&&(
                  <div style={{fontSize:11,color:C.warm,marginTop:8,textAlign:"center",lineHeight:1.5}}>연결된 학부모가 없습니다.<br/>학부모 계정에서 초대 후 알림을 보낼 수 있습니다.</div>
                )}
              </>
            )}
          </>
        )}
      </BottomSheet>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 6. SCHEDULE (calendar)
// ══════════════════════════════════════════════════════════════
const AdminSchedule=({schedules,students=[],onAddSchedule,onUpdateSchedule,onDeleteSchedule,onBack})=>{
  const now=new Date();
  const[year,setYear]=useState(now.getFullYear());
  const[mon,setMon]=useState(now.getMonth()+1);
  const[selDay,setSelDay]=useState(now.getDate());
  const[showAdd,setShowAdd]=useState(false);
  const[editId,setEditId]=useState(null);
  const[newType,setNewType]=useState("class");
  const[newTitle,setNewTitle]=useState("");
  const[newTime,setNewTime]=useState("15:00");
  const[newStudentIds,setNewStudentIds]=useState([]);
  const[saving,setSaving]=useState(false);

  const toggleStudent=id=>setNewStudentIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  const firstDay=new Date(year,mon-1,1).getDay();
  const lastDate=new Date(year,mon,0).getDate();
  const evForDay=d=>schedules.filter(s=>{const[sy,sm,sd]=s.date.split("-").map(Number);return sy===year&&sm===mon&&sd===d;});
  const holidayOnDay=d=>{
    const ds=`${year}-${String(mon).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return getHolidayForDate(ds);
  };
  const cells=[];
  for(let i=0;i<firstDay;i++)cells.push(null);
  for(let d=1;d<=lastDate;d++)cells.push(d);
  const selEvs=evForDay(selDay);
  const monthHolidayCount=KOREAN_HOLIDAYS.filter(h=>{const[,m]=h.date.split("-").map(Number);return h.date.startsWith(String(year))&&m===mon;}).length;

  const openForm=(ev=null)=>{
    if(ev?.autoHoliday)return;
    if(ev){
      setEditId(ev.id);setNewType(ev.type);setNewTitle(ev.title);setNewTime(ev.time??"15:00");
      setNewStudentIds(ev.studentIds??(ev.studentId?[ev.studentId]:[]));
    }else{
      setEditId(null);setNewType("class");setNewTitle("");setNewTime("15:00");setNewStudentIds([]);
    }
    setShowAdd(true);
  };

  const saveSchedule=async()=>{
    const dateStr=`${year}-${String(mon).padStart(2,"0")}-${String(selDay).padStart(2,"0")}`;
    if(newType==="makeup"){
      if(!newStudentIds.length){showAlert("보강 학생을 1명 이상 선택해 주세요.");return;}
      if(!newTime?.trim()){showAlert("보강 시간을 입력해 주세요.");return;}
    }
    const selectedNames=students.filter(s=>newStudentIds.includes(s.id)).map(s=>s.name);
    const autoTitle=newType==="makeup"&&selectedNames.length
      ? `${selectedNames.join(", ")} 보강`
      : "";
    const title=(newTitle.trim()||autoTitle).trim();
    if(!title){showAlert("일정 제목을 입력해 주세요.");return;}
    const payload={
      type:newType,
      title,
      time:newType==="closure"?null:newTime,
      studentIds:newType==="makeup"?newStudentIds:[],
      studentName:newType==="makeup"?selectedNames.join(", "):null,
    };
    setSaving(true);
    try{
      if(editId) await onUpdateSchedule(editId,{...payload,date:dateStr});
      else await onAddSchedule({date:dateStr,...payload});
      setShowAdd(false);
    }catch{/* 오류는 상위에서 alert */ }
    finally{ setSaving(false); }
  };

  return(
    <div style={{padding:"0 16px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {onBack&&<button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.warm}}>←</button>}
          <div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>일정 관리</div>
        </div>
        <button onClick={()=>openForm()} style={{background:C.terra,color:"white",border:"none",borderRadius:20,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 추가</button>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <button onClick={()=>{if(mon===1){setMon(12);setYear(y=>y-1)}else setMon(m=>m-1)}} style={{width:36,height:36,borderRadius:18,background:C.beige,border:"none",cursor:"pointer",fontSize:16}}>‹</button>
        <span style={{fontSize:16,fontWeight:800,color:C.charcoal}}>{year}년 {mon}월</span>
        <button onClick={()=>{if(mon===12){setMon(1);setYear(y=>y+1)}else setMon(m=>m+1)}} style={{width:36,height:36,borderRadius:18,background:C.beige,border:"none",cursor:"pointer",fontSize:16}}>›</button>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {[{t:"class",l:"정규"},{t:"makeup",l:"보강"},{t:"closure",l:"휴원"},{t:"holiday",l:"공휴일"},{t:"event",l:"행사"}].map(({t,l})=>{
          const{c}=typeColor(t);return <div key={t} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:5,background:c}}/><span style={{fontSize:11,color:C.warm}}>{l}</span></div>;
        })}
        <Badge small color="red">자동 {monthHolidayCount}건</Badge>
      </div>
      <Card style={{padding:12,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:8}}>
          {["일","월","화","수","목","금","토"].map((d,i)=>(
            <div key={d} style={{textAlign:"center",fontSize:11,fontWeight:600,color:i===0?C.red:i===6?C.blue:C.warm,padding:"4px 0"}}>{d}</div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {cells.map((d,i)=>{
            if(!d)return <div key={`e${i}`}/>;
            const evs=evForDay(d);
            const hol=holidayOnDay(d);
            const isToday=year===now.getFullYear()&&mon===now.getMonth()+1&&d===now.getDate();
            const isSel=d===selDay;
            const dow=i%7;
            return(
              <div key={d} onClick={()=>setSelDay(d)} style={{borderRadius:10,padding:"6px 2px",cursor:"pointer",background:isSel?C.terra:isToday?"#FFF0E6":hol?"#FFF5F5":"transparent",textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:isToday||isSel||hol?800:400,color:isSel?"white":isToday?C.terra:hol?"#C0392B":dow===0?C.red:dow===6?C.blue:C.charcoal,marginBottom:3}}>{d}</div>
                <div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"center"}}>
                  {hol&&!evs.some(e=>e.autoHoliday)&&<div style={{width:6,height:6,borderRadius:3,background:isSel?"rgba(255,255,255,0.7)":"#C0392B"}}/>}
                  {evs.slice(0,hol?1:2).map(ev=>{const{c}=typeColor(ev.type);return <div key={ev.id} style={{width:6,height:6,borderRadius:3,background:isSel?"rgba(255,255,255,0.7)":c}}/>;  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <SecTitle>{mon}월 {selDay}일</SecTitle>
      {selEvs.length===0?(
        <Card style={{textAlign:"center",padding:"20px 0",color:C.warm,fontSize:13}}>일정 없음 · <span onClick={()=>openForm()} style={{color:C.terra,cursor:"pointer",fontWeight:600}}>+ 추가</span></Card>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {selEvs.map(ev=>{
            const{bg,c}=typeColor(ev.type);
            return(
              <Card key={ev.id} style={{display:"flex",gap:12,alignItems:"center",border:ev.autoHoliday?`1px solid #F5C6C6`:"none"}}>
                <div style={{width:40,height:40,borderRadius:12,background:bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {ev.autoHoliday?<span style={{fontSize:18}}>{ev.substitute?"📅":"🇰🇷"}</span>:<div style={{width:12,height:12,borderRadius:6,background:c}}/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{ev.title}</div>
                    {ev.autoHoliday&&<Badge small color="red">{ev.substitute?"대체공휴일":"공휴일"}</Badge>}
                  </div>
                  <div style={{fontSize:12,color:C.warm,marginTop:2,display:"flex",alignItems:"center",gap:6}}>
                    {ev.time&&<span>🕒 {ev.time}</span>}
                    <Badge small color={ev.type==="holiday"?"red":ev.type==="closure"?"red":ev.type==="makeup"?"green":ev.type==="event"?"gold":"blue"}>{typeLabel(ev.type)}</Badge>
                    {ev.autoHoliday&&<span style={{fontSize:10,color:C.warm}}>자동 등록</span>}
                  </div>
                  {ev.studentName&&<div style={{fontSize:11,color:C.terra,marginTop:3}}>👤 {ev.studentName}</div>}
                  {ev.type==="makeup"&&!ev.studentName&&formatScheduleStudentNames(ev,students)&&(
                    <div style={{fontSize:11,color:C.terra,marginTop:3}}>👤 {formatScheduleStudentNames(ev,students)}</div>
                  )}
                </div>
                {!ev.autoHoliday&&<AdminActionBtns
                  onEdit={()=>openForm(ev)}
                  onDelete={()=>{if(window.confirm("이 일정을 삭제할까요?"))void onDeleteSchedule(ev.id);}}
                />}
              </Card>
            );
          })}
        </div>
      )}
      <BottomSheet open={showAdd} onClose={()=>setShowAdd(false)} title={editId?"일정 수정":"일정 추가"}>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:C.warm,marginBottom:8}}>종류</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{id:"class",l:"정규 수업"},{id:"makeup",l:"보강"},{id:"closure",l:"휴원"},{id:"event",l:"행사"}].map(o=>{
              const{bg,c}=typeColor(o.id);
              return <button key={o.id} onClick={()=>setNewType(o.id)} style={{padding:10,borderRadius:10,background:newType===o.id?bg:C.beige,border:`2px solid ${newType===o.id?c:"transparent"}`,color:newType===o.id?c:C.warm,fontSize:13,fontWeight:600,cursor:"pointer"}}>{o.l}</button>;
            })}
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:C.warm,marginBottom:4}}>제목</div>
          <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder={newType==="makeup"?"비워두면 자동 생성":"일정 제목"} style={{width:"100%",padding:"10px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:14,outline:"none",background:C.cream,color:C.charcoal}}/>
        </div>
        {newType==="makeup"&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:C.warm,marginBottom:8}}>보강 학생 · {newStudentIds.length}명 선택</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:180,overflowY:"auto"}}>
              {students.length===0?(
                <div style={{fontSize:12,color:C.warm,padding:"8px 0"}}>등록된 학생이 없습니다</div>
              ):students.map(st=>(
                <label key={st.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:10,background:newStudentIds.includes(st.id)?"#E8F4EA":C.beige,cursor:"pointer"}}>
                  <input type="checkbox" checked={newStudentIds.includes(st.id)} onChange={()=>toggleStudent(st.id)} style={{accentColor:C.sage}}/>
                  <span style={{fontSize:13,fontWeight:600,color:C.charcoal}}>{st.name}</span>
                  <span style={{fontSize:11,color:C.warm,marginLeft:"auto"}}>{st.grade} · {st.classTime}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {newType!=="closure"&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:C.warm,marginBottom:4}}>시간</div>
            <input value={newTime} onChange={e=>setNewTime(e.target.value)} placeholder="15:00" style={{width:"100%",padding:"10px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:14,outline:"none",background:C.cream,color:C.charcoal}}/>
          </div>
        )}
        <button onClick={saveSchedule} disabled={saving} style={{width:"100%",padding:14,borderRadius:12,background:saving?C.light:C.terra,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>{saving?"저장 중…":editId?"수정 저장":"저장"}</button>
      </BottomSheet>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// PARENT SCHEDULE (read-only calendar)
// ══════════════════════════════════════════════════════════════
const ParentScheduleCalendar=({student,schedules})=>{
  const now=new Date();
  const[year,setYear]=useState(now.getFullYear());
  const[mon,setMon]=useState(now.getMonth()+1);
  const[selDay,setSelDay]=useState(now.getDate());

  const firstDay=new Date(year,mon-1,1).getDay();
  const lastDate=new Date(year,mon,0).getDate();
  const dueDay=paymentDueDay(year,mon,student.feeDueDay);
  const viewMonthKey=`${year}-${String(mon).padStart(2,"0")}`;
  const duePaid=isPaidForMonth(student, viewMonthKey);
  const currentMonthPaid=isPaidForMonth(student, getCalendarMonthKey());

  const evForDay=d=>{
    const extra=[];
    if(d===dueDay){
      extra.push({
        id:`pay-${year}-${mon}`,
        type:"payment",
        title:`${student.name} 수강료 납부일`,
        time:null,
        studentName:student.name,
        amount:student.monthlyFee,
        paid:duePaid,
      });
    }
    return getParentEventsForDay({student,schedules,year,mon,day:d,extraEvents:extra});
  };

  const holidayOnDay=d=>{
    const ds=`${year}-${String(mon).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return getHolidayForDate(ds);
  };

  const cells=[];
  for(let i=0;i<firstDay;i++)cells.push(null);
  for(let d=1;d<=lastDate;d++)cells.push(d);

  const selEvs=evForDay(selDay);
  const isToday=year===now.getFullYear()&&mon===now.getMonth()+1&&selDay===now.getDate();
  const dueInfo=daysUntilPaymentDue(student,now);

  return(
    <div style={{padding:"0 16px 16px"}}>
      <div style={{padding:"16px 0 8px"}}>
        <div style={{fontSize:11,color:C.warm,marginBottom:4}}>학원 일정 · 열람 전용</div>
        <div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>{student.name} 일정</div>
      </div>

      {dueInfo&&!currentMonthPaid&&dueInfo.daysLeft<=3&&(
        <Card style={{marginBottom:14,background:"#FFF8F3",border:`1px solid ${C.terraL}`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.terra,marginBottom:4}}>
            💰 수강료 납부 {dueInfo.daysLeft===0?"오늘":`${dueInfo.daysLeft}일 후`}
          </div>
          <div style={{fontSize:12,color:C.warm,lineHeight:1.6}}>
            {fmtMoney(student.monthlyFee)} · 매월 {student.feeDueDay}일 ({dueInfo.dueStr})
          </div>
        </Card>
      )}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <button onClick={()=>{if(mon===1){setMon(12);setYear(y=>y-1)}else setMon(m=>m-1);setSelDay(1)}} style={{width:36,height:36,borderRadius:18,background:C.beige,border:"none",cursor:"pointer",fontSize:16}}>‹</button>
        <span style={{fontSize:16,fontWeight:800,color:C.charcoal}}>{year}년 {mon}월</span>
        <button onClick={()=>{if(mon===12){setMon(1);setYear(y=>y+1)}else setMon(m=>m+1);setSelDay(1)}} style={{width:36,height:36,borderRadius:18,background:C.beige,border:"none",cursor:"pointer",fontSize:16}}>›</button>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        {[{t:"class",l:"수업"},{t:"makeup",l:"보강"},{t:"closure",l:"휴원"},{t:"event",l:"행사"},{t:"holiday",l:"공휴일"},{t:"payment",l:"납부일"}].map(({t,l})=>{
          const{c}=typeColor(t);return <div key={t} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:5,background:c}}/><span style={{fontSize:11,color:C.warm}}>{l}</span></div>;
        })}
      </div>

      <Card style={{padding:12,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:8}}>
          {["일","월","화","수","목","금","토"].map((d,i)=>(
            <div key={d} style={{textAlign:"center",fontSize:11,fontWeight:600,color:i===0?C.red:i===6?C.blue:C.warm,padding:"4px 0"}}>{d}</div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {cells.map((d,i)=>{
            if(!d)return <div key={`e${i}`}/>;
            const evs=evForDay(d);
            const hol=holidayOnDay(d);
            const isDue=d===dueDay;
            const isReminder=year===now.getFullYear()&&mon===now.getMonth()+1&&!duePaid&&d>dueDay-3&&d<dueDay;
            const isSel=d===selDay;
            const isT=year===now.getFullYear()&&mon===now.getMonth()+1&&d===now.getDate();
            const dow=i%7;
            return(
              <div key={d} onClick={()=>setSelDay(d)} style={{borderRadius:10,padding:"6px 2px",cursor:"pointer",background:isSel?C.terra:isT?"#FFF0E6":hol?"#FFF5F5":"transparent",textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:isT||isSel||isDue?800:400,color:isSel?"white":isT?C.terra:isDue&&!duePaid?C.terra:hol?"#C0392B":dow===0?C.red:dow===6?C.blue:C.charcoal,marginBottom:3}}>{d}</div>
                <div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"center",minHeight:14}}>
                  {isDue&&<div style={{width:7,height:7,borderRadius:4,background:isSel?"white":duePaid?C.sage:C.terra}} title="납부일"/>}
                  {isReminder&&<div style={{width:5,height:5,borderRadius:3,background:isSel?"rgba(255,255,255,0.6)":C.gold}} title="납부 임박"/>}
                  {hol&&!isDue&&<div style={{width:5,height:5,borderRadius:3,background:isSel?"rgba(255,255,255,0.7)":"#C0392B"}}/>}
                  {evs.filter(e=>e.type!=="payment").slice(0,2).map(ev=>{const{c}=typeColor(ev.type);return <div key={ev.id} style={{width:5,height:5,borderRadius:3,background:isSel?"rgba(255,255,255,0.7)":c}}/>;})}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <SecTitle>{mon}월 {selDay}일</SecTitle>
      {selEvs.length===0?(
        <Card style={{textAlign:"center",padding:"24px 0",color:C.warm,fontSize:13}}>등록된 일정이 없습니다</Card>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {selEvs.map(ev=>{
            const{bg,c}=typeColor(ev.type);
            return(
              <Card key={ev.id} style={{display:"flex",gap:12,alignItems:"center",border:ev.type==="payment"&&!ev.paid?`1px solid ${C.terraL}`:"none"}}>
                <div style={{width:40,height:40,borderRadius:12,background:bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:ev.type==="payment"?"18px":undefined}}>
                  {ev.type==="payment"?"💰":ev.autoHoliday?<span style={{fontSize:18}}>🇰🇷</span>:<div style={{width:12,height:12,borderRadius:6,background:c}}/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{ev.title}</div>
                  <div style={{fontSize:12,color:C.warm,marginTop:2,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    {ev.time&&<span>🕒 {ev.time}</span>}
                    <Badge small color={ev.type==="payment"?ev.paid?"green":"terra":ev.type==="holiday"?"red":"blue"}>{ev.type==="payment"?ev.paid?"납부완료":"납부 예정":typeLabel(ev.type)}</Badge>
                    {ev.type==="payment"&&<span>{fmtMoney(ev.amount)}</span>}
                  </div>
                  {ev.studentName&&ev.type!=="payment"&&<div style={{fontSize:11,color:C.terra,marginTop:3}}>👤 {ev.studentName}</div>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 7. STATISTICS
// ══════════════════════════════════════════════════════════════
const AdminStats=({onBack, students=[], artworks=[], attendanceRecords=[], academy})=>{
  const revenueData=useMemo(()=>buildMonthlyRevenue(students),[students]);
  const attendWeek=useMemo(()=>buildWeeklyAttendance(students, attendanceRecords),[students, attendanceRecords]);
  const rankedStudents=useMemo(
    ()=>[...students].sort((a,b)=>(b.artCount||0)-(a.artCount||0)),
    [students]
  );
  const maxArtCount=Math.max(...rankedStudents.map(s=>s.artCount||0), 1);
  const currentMonth=revenueData[revenueData.length-1];
  const maxRev=Math.max(...revenueData.map(d=>d.v),1);
  const paidMonths=revenueData.filter(d=>d.v>0);
  const avg=paidMonths.length
    ? Math.round(paidMonths.reduce((a,d)=>a+d.v,0)/paidMonths.length)
    : 0;
  const currentMonthLabel=currentMonth?.m ?? "";

  return(
    <div style={{padding:"0 16px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 0"}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.warm}}>←</button>
        <div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>월별 통계</div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        {[{l:"이달 매출",v:currentMonth?.v?fmtMoney(currentMonth.v):"0원",c:C.terra},{l:"월 평균",v:avg?`${Math.round(avg/10000)}만원`:"0원",c:C.sage},{l:"재원 학생",v:`${students.length}명`,c:C.blue}].map(s=>(
          <Card key={s.l} style={{flex:1,padding:12,textAlign:"center"}}>
            <div style={{fontSize:14,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:C.warm,marginTop:2}}>{s.l}</div>
          </Card>
        ))}
      </div>
      <Card style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:16}}>월별 매출 추이</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:8,height:100,marginBottom:8}}>
          {revenueData.map(d=>(
            <div key={d.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:9,color:C.warm}}>{d.v>0?`${Math.round(d.v/10000)}`:""}</div>
              <div style={{width:"100%",borderRadius:"6px 6px 0 0",background:d.m===currentMonthLabel?C.terra:d.v===0?C.beige:C.terraL,height:`${d.v>0?(d.v/maxRev)*80:6}px`,minHeight:6,transition:"height .6s"}}/>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          {revenueData.map(d=><div key={d.key} style={{flex:1,textAlign:"center",fontSize:10,color:d.m===currentMonthLabel?C.terra:C.warm,fontWeight:d.m===currentMonthLabel?700:400}}>{d.m}</div>)}
        </div>
      </Card>
      <Card style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:8}}>출석부 Word</div>
        <div style={{fontSize:12,color:C.warm,marginBottom:12}}>전체 학생 출석 현황표 (가로 A4)</div>
        <AttendanceExportBtn students={students} attendanceRecords={attendanceRecords} academy={academy}/>
      </Card>
      <Card style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:14}}>이번 주 출석</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {attendWeek.map(d=>(
            <div key={d.day} style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:24,fontSize:12,fontWeight:600,color:C.warm}}>{d.day}</div>
              <div style={{flex:1}}><ProgressBar value={d.total?((d.present/d.total)*100):0} color={d.total&&d.present===d.total?C.sage:C.gold} h={8}/></div>
              <div style={{fontSize:12,fontWeight:600,color:C.charcoal,minWidth:32,textAlign:"right"}}>{d.total?`${d.present}/${d.total}`:"0/0"}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:14}}>학생별 작품 수</div>
        {rankedStudents.length===0 ? (
          <div style={{textAlign:"center",padding:"24px 0",color:C.warm,fontSize:13}}>등록된 학생이 없습니다</div>
        ) : rankedStudents.map((s,i)=>(
          <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:22,height:22,borderRadius:11,background:i<3?[C.gold,"#C0C0C0","#CD7F32"][i]:C.beige,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:i<3?"white":C.warm,flexShrink:0}}>{i+1}</div>
            <StudentAvatar student={s} size={28} fontSize={14}/>
            <span style={{fontSize:13,fontWeight:600,color:C.charcoal,flex:1}}>{s.name}</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:60}}><ProgressBar value={((s.artCount||0)/maxArtCount)*100} color={C.terra} h={6}/></div>
              <span style={{fontSize:12,fontWeight:700,color:C.terra,minWidth:28,textAlign:"right"}}>{s.artCount||0}점</span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 8. NOTICE MANAGER (공지 CRUD)
// ══════════════════════════════════════════════════════════════
const NoticeManager=({notices,onAddNotice,onUpdateNotice,onDeleteNotice,onBack,isParent=false})=>{
  const[noticeTab,setNoticeTab]=useState("general");
  const[showForm,setShowForm]=useState(false);
  const[editId,setEditId]=useState(null);
  const[title,setTitle]=useState("");
  const[content,setContent]=useState("");
  const[important,setImportant]=useState(false);

  const scopedNotices=useMemo(()=>({
    general:notices.filter(n=>getNoticeScope(n)==="general"),
    individual:notices.filter(n=>getNoticeScope(n)==="individual"),
  }),[notices]);
  const visibleNotices=isParent?notices:(noticeTab==="individual"?scopedNotices.individual:scopedNotices.general);

  const openForm=(n=null)=>{
    if(n){
      setEditId(n.id);setTitle(n.title);setContent(n.content);setImportant(n.important);
    }else{
      setEditId(null);setTitle("");setContent("");setImportant(false);
    }
    setShowForm(true);
  };

  const save=async()=>{
    if(!title.trim())return;
    const payload={title,content,important,date:new Date().toISOString().slice(0,10),scope:"general"};
    try{
      if(editId) await onUpdateNotice(editId,payload);
      else await onAddNotice({id:`n${Date.now()}`,...payload});
      setShowForm(false);
    }catch{ /* alert in handlers */ }
  };

  return(
    <div style={{padding:"0 16px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.warm}}>←</button>
          <div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>{isParent?"공지사항":"공지 관리"}</div>
        </div>
        {!isParent&&noticeTab==="general"&&<button onClick={()=>openForm()} style={{background:C.terra,color:"white",border:"none",borderRadius:20,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 작성</button>}
      </div>
      {!isParent&&(
        <div style={{display:"flex",background:C.white,borderRadius:12,border:`1px solid ${C.beige}`,marginBottom:12,overflow:"hidden"}}>
          {[
            {id:"individual",l:`개별공지 ${scopedNotices.individual.length}`},
            {id:"general",l:`전체공지 ${scopedNotices.general.length}`},
          ].map(t=>(
            <button key={t.id} onClick={()=>setNoticeTab(t.id)} style={{flex:1,padding:"11px 0",border:"none",background:noticeTab===t.id?C.cream:"transparent",fontSize:12,fontWeight:noticeTab===t.id?700:400,color:noticeTab===t.id?C.terra:C.warm,cursor:"pointer"}}>{t.l}</button>
          ))}
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {visibleNotices.length===0?(
          <div style={{textAlign:"center",padding:"48px 16px",color:C.warm,fontSize:13,lineHeight:1.7}}>
            {isParent?"등록된 공지가 없습니다.":noticeTab==="individual"?"개별 공지가 없습니다.":"작성된 전체 공지가 없습니다."}
          </div>
        ):visibleNotices.map(n=>(
          <Card key={n.id} style={{borderLeft:`3px solid ${n.important?C.red:C.light}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{fontSize:14,fontWeight:700,color:C.charcoal,flex:1,paddingRight:8}}>{n.title}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {!isParent&&getNoticeScope(n)==="individual"&&<Badge color="blue" small>개별</Badge>}
                {n.important&&<Badge color="red" small>중요</Badge>}
                {!isParent&&getNoticeScope(n)==="general"&&<AdminActionBtns
                  onEdit={()=>openForm(n)}
                  onDelete={()=>{if(window.confirm("이 공지를 삭제할까요?"))void onDeleteNotice(n.id);}}
                />}
                {!isParent&&getNoticeScope(n)==="individual"&&(
                  <button onClick={()=>{if(window.confirm("이 공지를 삭제할까요?"))void onDeleteNotice(n.id);}} style={{padding:"4px 10px",borderRadius:8,background:"#FDEAEA",color:C.red,border:"none",fontSize:11,fontWeight:600,cursor:"pointer"}}>삭제</button>
                )}
              </div>
            </div>
            <div style={{fontSize:13,color:C.charcoal,lineHeight:1.7,marginBottom:8}}>{n.content}</div>
            <div style={{fontSize:11,color:C.warm}}>{n.date}</div>
          </Card>
        ))}
      </div>
      <BottomSheet open={showForm} onClose={()=>setShowForm(false)} title={editId?"공지 수정":"공지 작성"}>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:C.warm,marginBottom:4}}>제목</div>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="공지 제목" style={{width:"100%",padding:"10px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:14,outline:"none",background:C.cream,color:C.charcoal}}/>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:C.warm,marginBottom:4}}>내용</div>
          <textarea value={content} onChange={e=>setContent(e.target.value)} rows={4} placeholder="공지 내용" style={{width:"100%",padding:"10px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:14,outline:"none",background:C.cream,color:C.charcoal,resize:"none",fontFamily:"inherit"}}/>
        </div>
        <div onClick={()=>setImportant(v=>!v)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,cursor:"pointer"}}>
          <div style={{width:20,height:20,borderRadius:6,background:important?C.red:C.beige,border:`2px solid ${important?C.red:C.light}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{important&&<span style={{fontSize:12,color:"white"}}>✓</span>}</div>
          <span style={{fontSize:13,color:C.charcoal}}>중요 공지로 표시</span>
        </div>
        <button onClick={save} style={{width:"100%",padding:14,borderRadius:12,background:C.terra,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>{editId?"수정 저장":"전체 학부모에게 발송"}</button>
      </BottomSheet>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 9. FEEDBACK MODAL (AI + 수기)
// ══════════════════════════════════════════════════════════════
const EMPTY_LESSON_NOTES = { topic: "", materials: "", features: "", good: "", hard: "", attitude: "" };

const FeedbackNotifyControls = ({ notifyMode, setNotifyMode, notifyDate, setNotifyDate, notifyTime, setNotifyTime }) => {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ marginBottom: 12, padding: 12, border: `1px solid ${C.light}`, borderRadius: 12, background: C.white }}>
      <div style={{ fontSize: 12, color: C.warm, marginBottom: 8, fontWeight: 600 }}>알림 발송 예약시간</div>
      <div style={{ display: "flex", gap: 8, marginBottom: notifyMode === "scheduled" ? 10 : 0 }}>
        <button
          type="button"
          onClick={() => setNotifyMode("immediate")}
          style={{
            flex: 1, padding: "9px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: notifyMode === "immediate" ? "none" : `1px solid ${C.light}`,
            background: notifyMode === "immediate" ? C.terra : C.white,
            color: notifyMode === "immediate" ? "white" : C.warm,
          }}
        >
          즉시 발송
        </button>
        <button
          type="button"
          onClick={() => setNotifyMode("scheduled")}
          style={{
            flex: 1, padding: "9px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: notifyMode === "scheduled" ? "none" : `1px solid ${C.light}`,
            background: notifyMode === "scheduled" ? C.terra : C.white,
            color: notifyMode === "scheduled" ? "white" : C.warm,
          }}
        >
          예약 발송
        </button>
      </div>
      {notifyMode === "scheduled" && (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="date"
            min={today}
            value={notifyDate}
            onChange={(e) => setNotifyDate(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", border: `1px solid ${C.light}`, borderRadius: 10, fontSize: 13, outline: "none", background: C.cream, color: C.charcoal }}
          />
          <input
            type="time"
            value={notifyTime}
            onChange={(e) => setNotifyTime(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", border: `1px solid ${C.light}`, borderRadius: 10, fontSize: 13, outline: "none", background: C.cream, color: C.charcoal }}
          />
        </div>
      )}
    </div>
  );
};

const FeedbackModal=({student,artworks,mode="ai",initialArtId=null,onClose,onSend})=>{
  const[loading,setLoading]=useState(false);
  const[result,setResult]=useState("");
  const[manualText,setManualText]=useState("");
  const[sent,setSent]=useState(false);
  const[sentNotifyLabel,setSentNotifyLabel]=useState("");
  const[selArtId,setSelArtId]=useState(initialArtId);
  const[lessonNotes,setLessonNotes]=useState({...EMPTY_LESSON_NOTES});
  const defaultNotify=useMemo(()=>defaultNotifyDateTime(),[]);
  const[notifyMode,setNotifyMode]=useState("immediate");
  const[notifyDate,setNotifyDate]=useState(defaultNotify.date);
  const[notifyTime,setNotifyTime]=useState(defaultNotify.time);
  const arts=useMemo(()=>artworks.filter(a=>a.studentId===student.id),[artworks,student.id]);
  const selectedArt=arts.find(a=>a.id===selArtId)??null;
  const isAi=mode==="ai";

  useEffect(()=>{
    if(initialArtId&&arts.some(a=>a.id===initialArtId)){
      setSelArtId(initialArtId);
    }
  },[initialArtId,student.id,arts]);

  const patchNote=(key,val)=>setLessonNotes(n=>({...n,[key]:val}));

  const buildPayload=(content)=>{
    const art=selectedArt??arts[0];
    return{
      studentId: student.id,
      studentName:student.name,
      content,
      date:new Date().toISOString().slice(0,10),
      read:false,
      artwork:art?.title??"수업 피드백",
      artEmoji:art?.emoji??"🎨",
    };
  };

  const sendFeedback=async()=>{
    const content=isAi?result.trim():manualText.trim();
    if(!content)return;
    const notifyScheduledAt=resolveNotifyScheduledAt(notifyMode, notifyDate, notifyTime);
    if(notifyMode==="scheduled"){
      if(!notifyScheduledAt){
        showAlert("올바른 예약 시간을 선택해 주세요.");
        return;
      }
      if(new Date(notifyScheduledAt).getTime()<=Date.now()){
        showAlert("예약 시간은 현재보다 이후여야 합니다.");
        return;
      }
    }
    try{
      await onSend({ ...buildPayload(content), notifyScheduledAt });
      setSentNotifyLabel(notifyMode==="scheduled"?formatNotifyScheduleLabel(notifyScheduledAt):"");
      setSent(true);
    }catch{ /* alert in onAddFeedback */ }
  };

  const generateFeedback=async()=>{
    if(!selectedArt){
      const hasNote=Object.values(lessonNotes).some(v=>v.trim());
      if(!hasNote){
        showAlert("작품을 선택하거나, 아래 수업 메모를 한 가지 이상 입력해 주세요.");
        return;
      }
    }
    setLoading(true);
    setResult("");
    try{
      setResult(await requestAIFeedback(student, selectedArt, lessonNotes));
    }catch(err){
      setResult(err.message||"API 연결 오류. 잠시 후 다시 시도해 주세요.");
    }
    setLoading(false);
  };

  return(
    <BottomSheet open onClose={onClose} title={isAi?"AI 피드백 생성":"피드백 직접 작성"}>
      {sent?(
        <div style={{textAlign:"center",padding:"24px 0"}}>
          <div style={{fontSize:56,marginBottom:12}}>📨</div>
          <div style={{fontSize:17,fontWeight:800,color:C.charcoal}}>피드백 발송 완료!</div>
          <div style={{fontSize:13,color:C.warm,marginTop:6}}>
            {sentNotifyLabel?`${sentNotifyLabel}에 알림이 예약되었습니다`:"학부모께 전달되었습니다"}
          </div>
        </div>
      ):isAi?(
        <>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14,padding:12,background:C.beige,borderRadius:12}}>
            <span style={{fontSize:32}}>{student.art}</span>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{student.name}</div>
              <div style={{fontSize:12,color:C.warm,marginTop:2}}>{studentAgeLabel(student)} · {student.school}</div>
            </div>
          </div>

          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:C.warm,marginBottom:8,fontWeight:600}}>피드백할 작품 선택</div>
            {arts.length===0?(
              <Card style={{padding:14,textAlign:"center",color:C.warm,fontSize:12}}>등록된 작품이 없습니다. 아래 수업 메모를 입력해 주세요.</Card>
            ):(
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
                {arts.map(a=>(
                  <ArtworkThumb
                    key={a.id}
                    artwork={a}
                    selected={selArtId===null ? true : selArtId===a.id}
                    onClick={()=>setSelArtId(selArtId===a.id?null:a.id)}
                  />
                ))}
              </div>
            )}
            {arts.length>0&&(
              <div style={{fontSize:10,color:C.warm,marginTop:6}}>선택하지 않으면 아래 수업 메모를 입력해 주세요</div>
            )}
          </div>

          {!selectedArt&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:C.warm,marginBottom:8,fontWeight:600}}>수업 메모 <span style={{fontWeight:400}}>(단어·짧은 문장)</span></div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {LESSON_NOTE_FIELDS.map(f=>(
                  <div key={f.key}>
                    <div style={{fontSize:11,color:C.warm,marginBottom:3}}>{f.label}</div>
                    <input value={lessonNotes[f.key]} onChange={e=>patchNote(f.key,e.target.value)} placeholder={f.ph}
                      style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:13,outline:"none",background:C.cream,color:C.charcoal}}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedArt&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:C.warm,marginBottom:8,fontWeight:600}}>추가 메모 <span style={{fontWeight:400}}>(선택)</span></div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {LESSON_NOTE_FIELDS.slice(0,3).map(f=>(
                  <input key={f.key} value={lessonNotes[f.key]} onChange={e=>patchNote(f.key,e.target.value)} placeholder={f.label}
                    style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:13,outline:"none",background:C.cream,color:C.charcoal}}/>
                ))}
              </div>
            </div>
          )}

          <button onClick={generateFeedback} disabled={loading} style={{width:"100%",padding:14,borderRadius:12,background:loading?C.beige:`linear-gradient(135deg,${C.terra},${C.terraD})`,color:loading?C.warm:"white",border:"none",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading?<><span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span>AI 작성 중...</>:"✨ AI 피드백 자동 생성"}
          </button>

          {result&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:C.warm,marginBottom:6}}>생성된 피드백</div>
              <textarea value={result} onChange={e=>setResult(e.target.value)} rows={6}
                style={{width:"100%",padding:14,border:`1px solid ${C.terraL}`,borderRadius:12,fontSize:13,color:C.charcoal,lineHeight:1.8,background:"#FFF8F3",outline:"none",resize:"none",fontFamily:"inherit"}}/>
            </div>
          )}

          {result.trim()&&(
            <>
              <FeedbackNotifyControls
                notifyMode={notifyMode} setNotifyMode={setNotifyMode}
                notifyDate={notifyDate} setNotifyDate={setNotifyDate}
                notifyTime={notifyTime} setNotifyTime={setNotifyTime}
              />
              <button onClick={sendFeedback} style={{width:"100%",padding:13,borderRadius:12,background:C.terra,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                {notifyMode==="scheduled"?"📅 예약 발송":"📱 앱 알림 발송"}
              </button>
            </>
          )}
        </>
      ):(
        <>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14,padding:12,background:C.beige,borderRadius:12}}>
            <span style={{fontSize:32}}>{student.art}</span>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{student.name}</div>
              <div style={{fontSize:12,color:C.warm,marginTop:2}}>{studentAgeLabel(student)}</div>
            </div>
          </div>
          <textarea value={manualText} onChange={e=>setManualText(e.target.value)} rows={8} placeholder="학부모에게 전달할 피드백을 직접 작성해 주세요."
            style={{width:"100%",padding:14,border:`1px solid ${C.light}`,borderRadius:12,fontSize:13,outline:"none",background:C.cream,color:C.charcoal,resize:"none",fontFamily:"inherit",lineHeight:1.8,marginBottom:14}}/>
          <FeedbackNotifyControls
            notifyMode={notifyMode} setNotifyMode={setNotifyMode}
            notifyDate={notifyDate} setNotifyDate={setNotifyDate}
            notifyTime={notifyTime} setNotifyTime={setNotifyTime}
          />
          <button onClick={sendFeedback} disabled={!manualText.trim()} style={{width:"100%",padding:13,borderRadius:12,background:manualText.trim()?C.terra:C.light,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:manualText.trim()?"pointer":"not-allowed"}}>
            {notifyMode==="scheduled"?"📅 예약 발송":"📱 앱 알림 발송"}
          </button>
        </>
      )}
    </BottomSheet>
  );
};

// ══════════════════════════════════════════════════════════════
// ADMIN FEEDBACK HISTORY
// ══════════════════════════════════════════════════════════════
const AdminFeedbackHistory=({feedbacks,onBack,onUpdateFeedback,onDeleteFeedback})=>{
  const[filter,setFilter]=useState("all");
  const[viewFb,setViewFb]=useState(null);
  const studentNames=[...new Set(feedbacks.map(f=>f.studentName))];
  const list=sortFeedbacksRecentFirst(
    filter==="all"?feedbacks:feedbacks.filter(f=>f.studentName===filter)
  );
  const unread=feedbacks.filter(f=>!f.read).length;

  return(
    <div style={{padding:"0 16px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 0 12px"}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.warm}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>학부모 피드백</div>
          <div style={{fontSize:12,color:C.warm,marginTop:2}}>발송 이력 · 미확인 {unread}건</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:14,paddingBottom:4}}>
        <button onClick={()=>setFilter("all")} style={{flexShrink:0,padding:"6px 14px",borderRadius:20,border:filter==="all"?"none":`1px solid ${C.light}`,background:filter==="all"?C.terra:C.white,color:filter==="all"?"white":C.warm,fontSize:12,fontWeight:600,cursor:"pointer"}}>전체</button>
        {studentNames.map(name=>(
          <button key={name} onClick={()=>setFilter(name)} style={{flexShrink:0,padding:"6px 14px",borderRadius:20,border:filter===name?"none":`1px solid ${C.light}`,background:filter===name?C.terra:C.white,color:filter===name?"white":C.warm,fontSize:12,fontWeight:600,cursor:"pointer"}}>{name}</button>
        ))}
      </div>
      {list.length===0?(
        <Card style={{textAlign:"center",padding:"40px 0",color:C.warm,fontSize:13}}>발송된 피드백이 없습니다</Card>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {list.map(f=>(
            <FeedbackMessageRow
              key={f.id}
              feedback={f}
              showStudent
              onOpen={setViewFb}
              extraBadges={f.notifyScheduledAt&&!f.notifySent?(
                <Badge color="gold" small>알림 {formatNotifyScheduleLabel(f.notifyScheduledAt)}</Badge>
              ):null}
              onEdit={()=>{const next=window.prompt("피드백 수정",f.content);if(next?.trim())onUpdateFeedback(f.id,{content:next.trim()});}}
              onDelete={()=>{if(window.confirm("이 피드백을 삭제할까요?"))onDeleteFeedback(f.id);}}
            />
          ))}
        </div>
      )}
      <BottomSheet open={!!viewFb} onClose={()=>setViewFb(null)} title={viewFb?`${viewFb.studentName} · ${viewFb.artwork||"피드백"}`:"피드백"}>
        {viewFb&&(
          <>
            <div style={{fontSize:12,color:C.warm,marginBottom:12}}>{viewFb.date} · {viewFb.read?"학부모 읽음":"미확인"}</div>
            <div style={{fontSize:14,color:C.charcoal,lineHeight:1.85,background:C.cream,borderRadius:12,padding:"14px 16px",whiteSpace:"pre-wrap"}}>{viewFb.content}</div>
          </>
        )}
      </BottomSheet>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// 10. MORE PAGE
// ══════════════════════════════════════════════════════════════
// ─── UpgradePage ───────────────────────────────────────────────
const UpgradePage = ({ onBack, plan, isMaster }) => {
  const planDefs = [
    { id:"free", icon:"🌱", label:"Free", price:"무료", color:"#8C7B72",
      features:["학생 최대 15명","월 사진 10장","직접 피드백 작성"],
      disabled:["AI 피드백","피드백 템플릿","입시 성적 관리","비밀 상담 일지"] },
    { id:"standard", icon:"⭐", label:"Standard", price:"₩37,000/월", color:"#7A9E7E", highlight:true,
      features:["무제한 학생","무제한 사진","✨ AI 피드백 자동 생성","피드백 템플릿","월별 통계"],
      disabled:["입시 성적 관리","비밀 상담 일지"] },
    { id:"premium", icon:"🏆", label:"Premium", price:"₩79,000/월", color:"#C9A84C",
      features:["Standard 모든 기능","🎯 입시 성적 관리","레이더 차트 분석","🔒 비밀 상담 일지","전용 고객 지원"],
      disabled:[] },
  ];
  return (
    <div>
      <div style={{background:`linear-gradient(160deg,${C.beige},${C.cream})`,padding:"16px 16px 24px"}}>
        <BackBtn onClick={onBack}/>
        <div style={{textAlign:"center",paddingTop:8}}>
          <div style={{fontSize:22,fontWeight:800,color:C.charcoal,marginBottom:4}}>플랜 업그레이드</div>
          {isMaster
            ? <div style={{fontSize:13,color:C.terra,fontWeight:600}}>🛠 개발자 계정 — Premium 전체 기능 활성화</div>
            : <div style={{fontSize:13,color:C.warm}}>현재 플랜: <strong>{PLANS[plan]?.label ?? "Free"}</strong></div>
          }
        </div>
      </div>
      <div style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
        {planDefs.map(p=>(
          <Card key={p.id} style={{border:p.highlight?`2px solid ${p.color}`:"1px solid #E8DDD0",padding:0,overflow:"hidden"}}>
            <div style={{background:p.highlight?`linear-gradient(135deg,${p.color}22,${p.color}08)`:"transparent",padding:"16px 16px 12px",borderBottom:`1px solid #E8DDD0`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:20}}>{p.icon}</span>
                  <span style={{fontSize:18,fontWeight:800,color:C.charcoal}}>{p.label}</span>
                  {plan===p.id&&<span style={{fontSize:11,fontWeight:700,color:p.color,background:`${p.color}20`,padding:"2px 8px",borderRadius:10}}>현재 플랜</span>}
                </div>
                <div style={{fontSize:16,fontWeight:800,color:p.color}}>{p.price}</div>
              </div>
            </div>
            <div style={{padding:"12px 16px"}}>
              {p.features.map(f=>(
                <div key={f} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                  <span style={{color:p.color,fontSize:12}}>✓</span>
                  <span style={{fontSize:13,color:C.charcoal}}>{f}</span>
                </div>
              ))}
              {p.disabled.map(f=>(
                <div key={f} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",opacity:0.4}}>
                  <span style={{color:C.light,fontSize:12}}>✗</span>
                  <span style={{fontSize:13,color:C.warm}}>{f}</span>
                </div>
              ))}
              {plan!==p.id&&p.id!=="free"&&(
                <button onClick={()=>showAlert("업그레이드 문의: admin@artmuse.kr")}
                  style={{width:"100%",marginTop:12,padding:"10px 0",borderRadius:10,background:p.color,color:"white",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  {p.label} 시작하기
                </button>
              )}
            </div>
          </Card>
        ))}
        <Card style={{padding:14,textAlign:"center",background:C.beige}}>
          <div style={{fontSize:12,color:C.warm,marginBottom:4}}>문의 및 업그레이드 신청</div>
          <div style={{fontSize:14,fontWeight:700,color:C.terra}}>admin@artmuse.kr</div>
        </Card>
      </div>
    </div>
  );
};

const AdminMore=({students,onNavigate,academy,logoSrc})=>(
  <div style={{padding:"0 16px 16px"}}>
    <div style={{fontSize:18,fontWeight:800,color:C.charcoal,padding:"16px 0"}}>더보기</div>
    <Card style={{marginBottom:20,padding:0,overflow:"hidden",cursor:"pointer"}} onClick={()=>onNavigate("settings")}>
      <div style={{background:`linear-gradient(135deg,${C.sand},${C.beige})`,padding:"20px 16px",display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:60,height:60,borderRadius:14,background:"white",boxShadow:"0 2px 12px rgba(61,53,48,0.12)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
          <img src={logoSrc} alt={academy.name} style={{width:56,height:"auto",objectFit:"contain"}}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:800,color:C.charcoal}}>{academy.name}</div>
          <div style={{fontSize:12,color:C.warm,marginTop:2}}>{academy.tagline}</div>
          <div style={{fontSize:11,color:C.terra,marginTop:4,fontWeight:600}}>학생 {students.length}명 · 학원 정보 수정 ›</div>
        </div>
      </div>
    </Card>
    <Card style={{padding:0}}>
      {[
        {icon:"⭐",label:"플랜 업그레이드", sub:"Free·Standard·Premium", page:"upgrade"},
        {icon:"₩",label:"수강료 관리",    sub:"납부·미납 확인",     page:"payments"},
        {icon:"📢",label:"공지 관리",    sub:"학부모 공지 발송",  page:"notice"},
        {icon:"📊",label:"월별 통계",    sub:"매출·출석 분석",   page:"stats"},
        {icon:"📈",label:"성장 비교",    sub:"Before/After 슬라이더", page:"beforeafter"},
        {icon:"👨‍👩‍👧",label:"학부모 계정",  sub:"초대·연결 관리",    page:"parent_accounts"},
        {icon:"💬",label:"학부모 피드백",sub:"피드백 발송 이력",  page:"feedback_history"},
        {icon:"🏫",label:"학원 정보",    sub:"학원명·연락처·로고", page:"settings"},
        {icon:"🔔",label:"알림 설정",   sub:"앱 푸시 알림",      page:"settings_notif"},
        {icon:"👤",label:"계정 설정",   sub:"프로필·비밀번호",   page:"settings_account"},
      ].map((item,i,arr)=>(
        <div key={item.label} onClick={()=>item.page&&onNavigate(item.page)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:i<arr.length-1?`1px solid ${C.beige}`:"none",cursor:item.page?"pointer":"default",opacity:item.page?1:0.55}}>
          <div style={{width:38,height:38,borderRadius:10,background:C.cream,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{item.icon}</div>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:C.charcoal}}>{item.label}</div><div style={{fontSize:11,color:C.warm,marginTop:1}}>{item.sub}</div></div>
          <span style={{color:C.light,fontSize:16}}>›</span>
        </div>
      ))}
    </Card>
    <div style={{textAlign:"center",marginTop:24,color:C.light,fontSize:11}}>ArtMuse v1.0.0 · art muse</div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// 11-13. PARENT VIEWS
// ══════════════════════════════════════════════════════════════
const ParentAppHeader = ({
  logoSrc,
  linkedChildren,
  activeChildId,
  onSelectChild,
  onNoticeTap,
  noticeCount = 0,
  onAddChild,
  isNativeApp,
  onExitApp,
}) => (
  <div style={{ padding: "0 16px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "16px 0 8px", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: C.warm }}>학부모 앱</div>
          {isNativeApp&&onExitApp&&(
            <button onClick={onExitApp} style={{padding:"2px 8px",borderRadius:12,background:"rgba(193,127,91,0.12)",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",color:C.warm,lineHeight:1.4}}>✕ 종료</button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Logo w={72} src={logoSrc} />
          {linkedChildren.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {linkedChildren.map((child) => {
                const active = child.id === activeChildId;
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => onSelectChild(child.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "7px 12px",
                      borderRadius: 20,
                      border: active ? "none" : `1px solid ${C.light}`,
                      background: active ? C.terra : C.white,
                      color: active ? "white" : C.charcoal,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>{child.art}</span>
                    <span>{child.name}</span>
                  </button>
                );
              })}
              {onAddChild && (
                <button
                  type="button"
                  onClick={onAddChild}
                  title="자녀 추가 연결"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    border: `1px dashed ${C.light}`,
                    background: C.white,
                    color: C.warm,
                    fontSize: 18,
                    lineHeight: 1,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  +
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {onNoticeTap && (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            onClick={onNoticeTap}
            style={{
              width: 42, height: 42, borderRadius: 21, background: C.beige,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, cursor: "pointer",
            }}
          >
            🔔
          </div>
          {noticeCount > 0 && (
            <div style={{
              position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8,
              background: C.red, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, color: "white", fontWeight: 700, border: "2px solid white", padding: "0 4px",
            }}
            >
              {noticeCount}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);

const ParentHome=({student,feedbacks,artworks,notices,attendanceRecords=[],schedules=[],onTab})=>{
  const arts=artworks.filter(a=>a.studentId===student.id);
  const fbs=sortFeedbacksRecentFirst(feedbacksForStudent(feedbacks, student));
  const latestNotice=[...notices].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const attendance=useMemo(
    ()=>studentAttendanceSummary(student.id, attendanceRecords),
    [student.id, attendanceRecords]
  );
  const todayAttend=useMemo(
    ()=>studentTodayAttendance(student.id, attendanceRecords, student.classTime),
    [student.id, student.classTime, attendanceRecords]
  );
  const todayAttendLabel={
    present:{title:"오늘 출석 완료",icon:"✅",border:"#E8F4EA",bg:"#E8F4EA"},
    late:{title:"오늘 지각 처리",icon:"⏰",border:"#FDF5E0",bg:"#FDF5E0"},
    absent:{title:"오늘 결석 처리",icon:"❌",border:"#FDEAEA",bg:"#FDEAEA"},
  }[todayAttend?.status];
  const todayStr=new Date().toISOString().slice(0,10);
  const closedToday=isAcademyClosedOnDate(schedules,todayStr);
  return(
    <div style={{padding:"0 16px 16px"}}>
      {closedToday&&(
        <Card style={{marginBottom:14,background:"#FFF5F5",border:"1px solid #F5C6C6",textAlign:"center",padding:"14px 16px"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#C0392B"}}>오늘은 휴원/공휴일입니다</div>
          <div style={{fontSize:12,color:C.warm,marginTop:4}}>정규 수업이 없는 날입니다</div>
        </Card>
      )}
      <Card style={{background:`linear-gradient(135deg,${C.sand},${C.beige})`,marginBottom:16}}>
        <div style={{display:"flex",gap:14,alignItems:"center"}}>
          <div style={{width:60,height:60,borderRadius:30,background:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,boxShadow:"0 3px 12px rgba(61,53,48,0.12)"}}>{student.art}</div>
          <div><div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>{student.name}</div><div style={{fontSize:13,color:C.warm,marginTop:2}}>{student.school} · {student.grade}</div><div style={{display:"flex",gap:6,marginTop:6}}>{student.tags.map(t=><Badge key={t} small>{t}</Badge>)}</div></div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:16,paddingTop:14,borderTop:`1px solid ${C.light}`}}>
          {[{l:"작품 수",v:arts.length,c:C.terra,tab:"partworks"},{l:"이달 출석",v:attendance.present,c:C.sage,tab:null},{l:"받은 피드백",v:fbs.length,c:C.blue,tab:"pfeedback"}].map(s=>(
            <div key={s.l} onClick={()=>s.tab&&onTab(s.tab)} style={{flex:1,textAlign:"center",cursor:s.tab?"pointer":"default"}}>
              <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:C.warm,marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>
      </Card>
      {todayAttend ? (
        <Card style={{marginBottom:14,display:"flex",alignItems:"center",gap:12,border:`1px solid ${todayAttendLabel?.border ?? C.beige}`}}>
          <div style={{width:44,height:44,borderRadius:22,background:todayAttendLabel?.bg ?? C.beige,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{todayAttendLabel?.icon ?? "📋"}</div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>{todayAttendLabel?.title ?? "오늘 출결"}</div>
            <div style={{fontSize:12,color:C.warm,marginTop:2}}>
              {formatAttendanceCheckIn(todayAttend.checked_at, todayAttend.attendance_date, todayAttend.class_time)}
            </div>
          </div>
        </Card>
      ) : (
        <Card style={{marginBottom:14,display:"flex",alignItems:"center",gap:12,border:`1px solid ${C.beige}`}}>
          <div style={{width:44,height:44,borderRadius:22,background:C.beige,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📋</div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>오늘 출석 기록 없음</div>
            <div style={{fontSize:12,color:C.warm,marginTop:2}}>원장님이 출결 처리하면 여기에 표시됩니다</div>
          </div>
        </Card>
      )}

      {latestNotice&&(
        <Card onClick={()=>onTab("pnotice")} style={{marginBottom:14,border:latestNotice.important?`1px solid ${C.terraL}`:`1px solid ${C.beige}`,cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
            <span style={{fontSize:20,flexShrink:0}}>📢</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <div style={{fontSize:13,fontWeight:700,color:C.charcoal,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{latestNotice.title}</div>
                {latestNotice.important&&<Badge color="red" small>중요</Badge>}
              </div>
              <div style={{fontSize:11,color:C.warm,marginBottom:6}}>{latestNotice.date}</div>
              <div style={{fontSize:12,color:C.charcoal,lineHeight:1.6,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{latestNotice.content}</div>
            </div>
            <span style={{color:C.light,fontSize:14,flexShrink:0}}>›</span>
          </div>
        </Card>
      )}

      <div style={{marginBottom:18}}>
        <SecTitle action="전체보기 →" onAction={()=>onTab("partworks")}>🎨 최근 작품</SecTitle>
        <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>
          {arts.slice(0,4).map(a=>(
            <div key={a.id} style={{flexShrink:0,width:100}}>
              <ArtworkThumb artwork={a} size={100} showLabel={false} onClick={()=>onTab("partworks")} />
              <div style={{fontSize:11,fontWeight:600,color:C.charcoal,textAlign:"center",marginTop:6}}>{a.title}</div>
              <div style={{fontSize:10,color:C.warm,textAlign:"center"}}>{a.date.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>
      <SecTitle action="전체보기 →" onAction={()=>onTab("pfeedback")}>💬 최근 피드백</SecTitle>
      {fbs.length===0?(
        <Card style={{textAlign:"center",padding:"24px 0",color:C.warm,fontSize:13}}>아직 피드백이 없습니다</Card>
      ):fbs.slice(0,3).map(f=>(
        <FeedbackMessageRow key={f.id} feedback={f} onOpen={()=>onTab("pfeedback")}/>
      ))}
    </div>
  );
};

const ParentArtworks=({student,artworks,academy,feedbacks=[],onUpload})=>{
  const arts=artworks.filter(a=>a.studentId===student.id);
  const[sel,setSel]=useState(null);
  return(
    <div style={{padding:"0 16px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"16px 0 8px",gap:10}}>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>{student.name}의 작품</div>
          <div style={{fontSize:12,color:C.warm,marginTop:4}}>총 {arts.length}점 · {academy?.name ?? "아트뮤즈"}</div>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        <button onClick={onUpload} style={{width:"100%",padding:14,borderRadius:12,background:C.terra,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>📷 집에서 완성한 작품 올리기</button>
        <PortfolioExportBtn student={student} artworks={artworks} academy={academy} feedbacks={feedbacks} style={{width:"100%"}} />
      </div>
      {sel?(
        <div>
          <BackBtn onClick={()=>setSel(null)}/>
          <Card style={{padding:0,overflow:"hidden",marginBottom:16}}>
            <ArtworkCover artwork={sel} height={220} fontSize={80} />
            <div style={{padding:16}}>
              <div style={{fontSize:17,fontWeight:800,color:C.charcoal,marginBottom:4}}>{sel.title}</div>
              <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                <Badge>{sel.medium}</Badge>
                <Badge color="blue">{sel.date}</Badge>
                {sel.uploadedBy==="parent"&&<Badge color="green">집에서 완성</Badge>}
              </div>
              <div style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:C.warm}}>완성도</span><span style={{fontSize:12,fontWeight:700,color:C.terra}}>{sel.progress}%</span></div><ProgressBar value={sel.progress} color={C.terra} h={6}/></div>
              <div style={{fontSize:13,color:C.charcoal,lineHeight:1.7,background:C.cream,borderRadius:10,padding:12}}>{sel.desc}</div>
            </div>
          </Card>
        </div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {arts.map(a=>(
            <Card key={a.id} onClick={()=>setSel(a)} style={{padding:0,overflow:"hidden"}}>
              <ArtworkCover artwork={a} height={160} fontSize={52} />
              <div style={{padding:"10px 12px 12px"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>{a.title}</div>
                <div style={{fontSize:11,color:C.warm,marginTop:2}}>{a.medium} · {a.date.slice(5)}{a.uploadedBy==="parent"?" · 집":" "}</div>
                <div style={{marginTop:8}}><ProgressBar value={a.progress} color={C.sage} h={4}/></div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ── 채팅 버블 공통 컴포넌트 ──────────────────────────────────
const ChatBubble=({content,isMe,time,role})=>{
  const ts=time?new Date(time).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}):"";
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",marginBottom:10}}>
      {!isMe&&<div style={{fontSize:10,color:C.warm,marginBottom:3,marginLeft:4}}>{role==="admin"?"선생님":"학부모"}</div>}
      <div style={{maxWidth:"78%",background:isMe?C.terra:C.white,color:isMe?"white":C.charcoal,borderRadius:isMe?"16px 4px 16px 16px":"4px 16px 16px 16px",padding:"10px 14px",fontSize:13,lineHeight:1.65,whiteSpace:"pre-wrap",boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
        {content}
      </div>
      <div style={{fontSize:10,color:C.warm,marginTop:3,marginHorizontal:4}}>{ts}</div>
    </div>
  );
};

// ── 채팅 입력창 공통 컴포넌트 ────────────────────────────────
const ChatInput=({onSend,placeholder="메시지를 입력하세요…",disabled})=>{
  const[text,setText]=useState("");
  const send=()=>{
    if(!text.trim()||disabled) return;
    onSend(text.trim());
    setText("");
  };
  return(
    <div style={{display:"flex",gap:8,padding:"10px 16px",borderTop:`1px solid ${C.light}`,background:C.cream,alignItems:"flex-end"}}>
      <textarea
        value={text}
        onChange={e=>setText(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
        placeholder={placeholder}
        rows={1}
        style={{flex:1,padding:"10px 14px",border:`1px solid ${C.light}`,borderRadius:18,fontSize:13,outline:"none",background:C.white,color:C.charcoal,resize:"none",fontFamily:"inherit",lineHeight:1.5,maxHeight:80,overflowY:"auto"}}
      />
      <button onClick={send} disabled={!text.trim()||disabled} style={{width:40,height:40,borderRadius:20,background:text.trim()?C.terra:C.light,color:"white",border:"none",fontSize:18,cursor:text.trim()?"pointer":"default",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>↑</button>
    </div>
  );
};

// ── 피드백 답변 쓰레드 (시트 내부) ──────────────────────────
const FeedbackThread=({feedback,academyId,userId,userRole})=>{
  const{data:replies=[],isLoading}=useFeedbackReplies(feedback?.id);
  const addReply=useFeedbackReplyMutation(academyId);
  const scrollRef=useRef(null);

  useEffect(()=>{
    if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight;
  },[replies.length]);

  const handleSend=(content)=>{
    addReply.mutate({feedbackId:feedback.id,senderId:userId,senderRole:userRole,content});
  };

  return(
    <div style={{display:"flex",flexDirection:"column"}}>
      {/* 원본 피드백 */}
      <div style={{background:C.cream,borderRadius:12,padding:"12px 16px",marginBottom:16,borderLeft:`3px solid ${C.terra}`}}>
        <div style={{fontSize:11,color:C.warm,marginBottom:6}}>선생님 · {feedback.date}</div>
        <div style={{fontSize:13,color:C.charcoal,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{feedback.content}</div>
      </div>
      {/* 답변 스레드 */}
      <div ref={scrollRef} style={{height:"calc(92vh - 340px)",overflowY:"auto",paddingBottom:8}}>
        {isLoading&&<div style={{textAlign:"center",color:C.warm,fontSize:12,padding:16}}>불러오는 중…</div>}
        {!isLoading&&replies.length===0&&(
          <div style={{textAlign:"center",color:C.warm,fontSize:12,padding:16}}>첫 번째 답변을 남겨보세요</div>
        )}
        {replies.map(r=>(
          <ChatBubble key={r.id} content={r.content} isMe={r.sender_role===userRole} time={r.created_at} role={r.sender_role}/>
        ))}
      </div>
      <ChatInput onSend={handleSend} placeholder="답변을 입력하세요…" disabled={addReply.isPending}/>
    </div>
  );
};

// ── 학부모: 피드백 목록 + 답변 ────────────────────────────────
const ParentFeedback=({student,feedbacks,onMarkRead,userId,academyId})=>{
  const fbs=sortFeedbacksRecentFirst(feedbacksForStudent(feedbacks, student));
  const[openFb,setOpenFb]=useState(null);

  const openFeedback=(f)=>{
    setOpenFb(f);
    if(!f.read) onMarkRead?.([f.id]);
  };

  return(
    <div style={{padding:"0 16px 16px",display:"flex",flexDirection:"column",flex:1}}>
      <div style={{fontSize:18,fontWeight:800,color:C.charcoal,padding:"16px 0 8px"}}>선생님 피드백</div>
      <div style={{fontSize:12,color:C.warm,marginBottom:16}}>총 {fbs.length}개 · 피드백을 눌러 답변할 수 있어요</div>
      {fbs.length===0?<Card style={{textAlign:"center",padding:"40px 0",color:C.warm}}>아직 피드백이 없습니다</Card>:(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {fbs.map(f=>(
            <FeedbackMessageRow key={f.id} feedback={f} onOpen={openFeedback}/>
          ))}
        </div>
      )}
      <BottomSheet open={!!openFb} onClose={()=>setOpenFb(null)} title={openFb?`${openFb.artEmoji} ${openFb.artwork||"수업 피드백"}`:"피드백"} fullHeight>
        {openFb&&<FeedbackThread feedback={openFb} academyId={academyId} userId={userId} userRole="parent"/>}
      </BottomSheet>
    </div>
  );
};

// ── 원장: 학생 채팅 탭 ───────────────────────────────────────
const AdminStudentChat=({student,academyId,adminId})=>{
  const{data:msgs=[],isLoading}=useMessages(academyId,student.id,{refetchInterval:8000});
  const{sendMessage,markRead}=useMessageMutations(academyId,student.id);
  const scrollRef=useRef(null);

  useEffect(()=>{
    if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight;
  },[msgs.length]);

  useEffect(()=>{
    if(msgs.some(m=>m.sender_role==="parent"&&!m.is_read)){
      markRead.mutate("admin");
    }
  },[msgs]);

  const handleSend=async(content)=>{
    sendMessage.mutate({senderId:adminId,senderRole:"admin",content},{
      onSuccess:async()=>{
        try{
          const sb=requireSupabase();
          const{data:rows}=await sb.from("parent_student_links").select("push_token").eq("academy_id",academyId).eq("student_id",student.id).not("push_token","is",null);
          const tokens=(rows??[]).map(r=>r.push_token).filter(Boolean);
          if(tokens.length) await sb.functions.invoke("push-notify",{body:{tokens,title:"선생님 메시지",body:content.length>40?content.slice(0,40)+"…":content,data:{type:"message"}}});
        }catch{}
      }
    });
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:420}}>
      <div style={{fontSize:12,color:C.warm,padding:"8px 0 12px"}}>📨 {student.name} 학부모와의 채팅</div>
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",paddingBottom:8}}>
        {isLoading&&<div style={{textAlign:"center",color:C.warm,fontSize:12,padding:16}}>불러오는 중…</div>}
        {!isLoading&&msgs.length===0&&(
          <div style={{textAlign:"center",color:C.warm,fontSize:12,padding:24}}>아직 메시지가 없습니다<br/>학부모에게 먼저 메시지를 보내보세요</div>
        )}
        {msgs.map(m=>(
          <ChatBubble key={m.id} content={m.content} isMe={m.sender_role==="admin"} time={m.created_at} role={m.sender_role}/>
        ))}
      </div>
      <ChatInput onSend={handleSend} disabled={sendMessage.isPending}/>
    </div>
  );
};

// ── 원장: DM 채팅방 (학생 1명) ──────────────────────────────
const AdminChatRoom=({student,academyId,adminId,onBack})=>{
  const{data:msgs=[],isLoading}=useMessages(academyId,student.id,{refetchInterval:4000});
  const{sendMessage,markRead}=useMessageMutations(academyId,student.id);
  const scrollRef=useRef(null);

  useEffect(()=>{
    if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight;
  },[msgs.length]);

  useEffect(()=>{
    if(msgs.some(m=>m.sender_role==="parent"&&!m.is_read)) markRead.mutate("admin");
  },[msgs]);

  const handleSend=async(content)=>{
    sendMessage.mutate({senderId:adminId,senderRole:"admin",content},{
      onSuccess:async()=>{
        try{
          const sb=requireSupabase();
          const{data:rows}=await sb.from("parent_student_links").select("push_token").eq("academy_id",academyId).eq("student_id",student.id).not("push_token","is",null);
          const tokens=(rows??[]).map(r=>r.push_token).filter(Boolean);
          if(tokens.length) await sb.functions.invoke("push-notify",{body:{tokens,title:`선생님: ${student.name}`,body:content.length>50?content.slice(0,50)+"…":content,data:{type:"message"}}});
        }catch{}
      }
    });
  };

  const CHAT_MSG_H="calc(92vh - 242px)";
  return(
    <div style={{display:"flex",flexDirection:"column"}}>
      {/* 헤더 */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:`1px solid ${C.light}`,background:C.white}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.charcoal,padding:"0 4px",lineHeight:1}}>←</button>
        <div style={{width:36,height:36,borderRadius:18,background:C.terraL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:C.terra,flexShrink:0}}>
          {student.name?.[0]}
        </div>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:C.charcoal}}>{student.name}</div>
          <div style={{fontSize:11,color:C.warm}}>{student.className||"학부모와 채팅"}</div>
        </div>
      </div>
      {/* 메시지 목록 */}
      <div ref={scrollRef} style={{height:CHAT_MSG_H,overflowY:"auto",padding:"12px 16px",background:C.cream}}>
        {isLoading&&<div style={{textAlign:"center",color:C.warm,fontSize:12,padding:20}}>불러오는 중…</div>}
        {!isLoading&&msgs.length===0&&(
          <div style={{textAlign:"center",padding:40}}>
            <div style={{fontSize:32,marginBottom:12}}>💬</div>
            <div style={{fontSize:13,color:C.warm,lineHeight:1.7}}>{student.name} 학부모에게<br/>첫 메시지를 보내보세요</div>
          </div>
        )}
        {msgs.map(m=>(
          <ChatBubble key={m.id} content={m.content} isMe={m.sender_role==="admin"} time={m.created_at} role={m.sender_role}/>
        ))}
      </div>
      <ChatInput onSend={handleSend} disabled={sendMessage.isPending}/>
    </div>
  );
};

// ── 원장: DM 목록 (Instagram DM 스타일) ─────────────────────
const AdminDMPage=({students,academyId,adminId})=>{
  const[selStudent,setSelStudent]=useState(null);
  const{data:latestMsgs={}}=useLatestMessagesByStudent(academyId);
  const{data:unreadCounts={}}=useUnreadCountByStudent(academyId);

  const totalUnread=Object.values(unreadCounts).reduce((a,b)=>a+b,0);

  const sorted=[...students].sort((a,b)=>{
    const la=latestMsgs[a.id],lb=latestMsgs[b.id];
    if(la&&!lb)return -1; if(!la&&lb)return 1;
    if(la&&lb)return new Date(lb.created_at)-new Date(la.created_at);
    return (a.name??'').localeCompare(b.name??'','ko');
  });

  const fmtTime=(iso)=>{
    if(!iso)return'';
    const d=new Date(iso),now=new Date();
    const diffD=Math.floor((now-d)/86400000);
    if(diffD===0)return d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
    if(diffD===1)return '어제';
    if(diffD<7)return `${diffD}일 전`;
    return d.toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'});
  };

  if(selStudent) return <AdminChatRoom student={selStudent} academyId={academyId} adminId={adminId} onBack={()=>setSelStudent(null)}/>;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"16px 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.light}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18,fontWeight:800,color:C.charcoal}}>메시지</span>
          {totalUnread>0&&<span style={{background:C.terra,color:"white",borderRadius:10,fontSize:11,fontWeight:700,padding:"2px 7px"}}>{totalUnread}</span>}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {sorted.length===0&&(
          <div style={{textAlign:"center",padding:"60px 24px",color:C.warm,fontSize:13}}>등록된 학생이 없습니다</div>
        )}
        {sorted.map(s=>{
          const last=latestMsgs[s.id];
          const unread=unreadCounts[s.id]??0;
          const preview=last?(last.sender_role==="admin"?"나: ":"")+last.content:"메시지를 보내보세요";
          const colors=["#E8A87C","#7A9E7E","#8B9DC3","#C17F9E","#9B8BB4","#C0A97A"];
          const bg=colors[(s.name?.charCodeAt(0)??0)%colors.length];
          return(
            <div key={s.id} onClick={()=>setSelStudent(s)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer",borderBottom:`1px solid ${C.beige}`,background:"white",transition:"background .1s"}}
              onMouseEnter={e=>e.currentTarget.style.background=C.cream}
              onMouseLeave={e=>e.currentTarget.style.background="white"}
            >
              <div style={{position:"relative",flexShrink:0}}>
                <div style={{width:52,height:52,borderRadius:26,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"white"}}>
                  {s.name?.[0]}
                </div>
                {unread>0&&(
                  <div style={{position:"absolute",top:-2,right:-2,width:18,height:18,borderRadius:9,background:C.terra,color:"white",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid white"}}>
                    {unread>9?"9+":unread}
                  </div>
                )}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <span style={{fontSize:14,fontWeight:unread>0?700:600,color:C.charcoal}}>{s.name}</span>
                  <span style={{fontSize:11,color:C.warm,flexShrink:0}}>{fmtTime(last?.created_at)}</span>
                </div>
                <div style={{fontSize:12,color:unread>0?C.charcoal:C.warm,fontWeight:unread>0?600:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"90%"}}>
                  {preview.length>35?preview.slice(0,35)+"…":preview}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── 학부모: 채팅 탭 ─────────────────────────────────────────
const ParentChatPage=({student,academyId,userId})=>{
  const{data:msgs=[],isLoading}=useMessages(academyId,student?.id,{refetchInterval:4000});
  const{sendMessage,markRead}=useMessageMutations(academyId,student?.id);
  const scrollRef=useRef(null);

  useEffect(()=>{
    if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight;
  },[msgs.length]);

  useEffect(()=>{
    if(msgs.some(m=>m.sender_role==="admin"&&!m.is_read)) markRead.mutate("parent");
  },[msgs]);

  const handleSend=(content)=>{
    sendMessage.mutate({senderId:userId,senderRole:"parent",content});
  };

  const CHAT_MSG_H="calc(92vh - 350px)";
  return(
    <div style={{display:"flex",flexDirection:"column",background:C.cream}}>
      {/* 채팅방 헤더 */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px 12px",borderBottom:`1px solid ${C.light}`,background:C.white}}>
        <div style={{width:40,height:40,borderRadius:20,background:C.terraL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:C.terra}}>🎨</div>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:C.charcoal}}>아트뮤즈 선생님</div>
          <div style={{fontSize:11,color:C.warm}}>{student?.name} 학부모</div>
        </div>
      </div>
      {/* 메시지 목록 */}
      <div ref={scrollRef} style={{height:CHAT_MSG_H,overflowY:"auto",padding:"12px 16px"}}>
        {isLoading&&<div style={{textAlign:"center",color:C.warm,fontSize:12,padding:20}}>불러오는 중…</div>}
        {!isLoading&&msgs.length===0&&(
          <div style={{textAlign:"center",padding:"48px 24px"}}>
            <div style={{fontSize:40,marginBottom:12}}>💬</div>
            <div style={{fontSize:14,fontWeight:700,color:C.charcoal,marginBottom:6}}>선생님께 메시지 보내기</div>
            <div style={{fontSize:12,color:C.warm,lineHeight:1.7}}>수업 관련 궁금한 점이나<br/>전달 사항을 자유롭게 보내세요</div>
          </div>
        )}
        {msgs.map(m=>(
          <ChatBubble key={m.id} content={m.content} isMe={m.sender_role==="parent"} time={m.created_at} role={m.sender_role}/>
        ))}
      </div>
      <ChatInput onSend={handleSend} placeholder="선생님께 메시지 보내기…" disabled={sendMessage.isPending}/>
    </div>
  );
};


// ══════════════════════════════════════════════════════════════
// LOGIN SCREEN (Auth flow demo)
// ══════════════════════════════════════════════════════════════
const ParentInviteLogin = ({ onLogin, onBack, onVerifyInvite, logoSrc, isNativeApp, onExitApp }) => {
  const isDev = import.meta.env.DEV;
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [studentName, setStudentName] = useState("");

  const handleLogin = async () => {
    if (isSignUp && code.length < 9) {
      setError("초대 코드 9자리를 입력해 주세요.");
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await onVerifyInvite(code, email.trim(), password, isSignUp);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStudentName(result.student?.name ?? "");
      setDone(true);
      setTimeout(() => onLogin("parent"), 600);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"100%",background:`linear-gradient(160deg,${C.cream} 0%,${C.beige} 100%)`}}>
      <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        {onBack
          ? <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.warm,display:"flex",alignItems:"center",gap:4}}>← 뒤로</button>
          : <div style={{width:48}}/>}
        {isNativeApp&&<button onClick={onExitApp} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:C.warm,fontWeight:600}}>앱 종료</button>}
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 28px 40px"}}>
        <Logo w={130} src={logoSrc}/>
        <div style={{marginTop:8,marginBottom:36,fontSize:13,color:C.warm,textAlign:"center",lineHeight:1.6}}>
          {isSignUp
            ? <>학부모 회원가입<br/>선생님께 받은 초대 코드를 입력하세요</>
            : "학부모 로그인"}
        </div>
        {done ? (
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:12}}>✅</div>
            <div style={{fontSize:16,fontWeight:700,color:C.charcoal}}>연결 완료!</div>
            {studentName && <div style={{fontSize:13,color:C.warm,marginTop:6}}>{studentName} 학부모님, 환영합니다</div>}
          </div>
        ) : (
          <div style={{width:"100%"}}>
            {isSignUp && (
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,color:C.warm,marginBottom:4}}>초대 코드 *</div>
                <input
                  value={code}
                  onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
                  placeholder={isDev ? "데모: ARTM-7K2P" : "ARTM-XXXX"}
                  maxLength={9}
                  style={{width:"100%",padding:"14px",border:`2px solid ${error ? C.red : code.length >= 9 ? C.sage : C.light}`,borderRadius:12,fontSize:20,fontWeight:700,letterSpacing:"0.12em",textAlign:"center",outline:"none",background:C.white,color:C.charcoal}}
                />
              </div>
            )}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:12,color:C.warm,marginBottom:4}}>이메일</div>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="학부모 이메일"
                style={{width:"100%",padding:"12px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:14,outline:"none",background:C.white,color:C.charcoal}}/>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:C.warm,marginBottom:4}}>비밀번호</div>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="6자 이상"
                style={{width:"100%",padding:"12px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:14,outline:"none",background:C.white,color:C.charcoal}}/>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <button onClick={()=>{ setIsSignUp(true); setError(""); }} style={{flex:1,padding:10,borderRadius:10,border:"none",background:isSignUp?C.terra:C.beige,color:isSignUp?"white":C.warm,fontSize:12,fontWeight:700,cursor:"pointer"}}>회원가입</button>
              <button onClick={()=>{ setIsSignUp(false); setCode(""); setError(""); }} style={{flex:1,padding:10,borderRadius:10,border:"none",background:!isSignUp?C.terra:C.beige,color:!isSignUp?"white":C.warm,fontSize:12,fontWeight:700,cursor:"pointer"}}>로그인</button>
            </div>
            {error && <div style={{fontSize:12,color:C.red,marginBottom:12,textAlign:"center"}}>{error}</div>}
            <button onClick={handleLogin} disabled={loading || (isSignUp && code.length < 9)}
              style={{width:"100%",padding:"15px",borderRadius:12,background:loading || (isSignUp && code.length < 9) ? C.light : C.terra,color:"white",border:"none",fontSize:15,fontWeight:700,cursor:loading || (isSignUp && code.length < 9) ? "not-allowed" : "pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {loading ? <><span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span>처리 중...</> : isSignUp ? "가입하고 연결" : "로그인"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const ParentConnectSheet = ({ onClose, onConnect }) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (code.length < 9) {
      setError("초대 코드 9자리를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await onConnect(code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet open onClose={onClose} title="초대 코드로 연결">
      <div style={{ fontSize: 13, color: C.warm, lineHeight: 1.6, marginBottom: 16 }}>
        학원에서 받은 초대 코드를 입력하면 자녀 정보가 연결됩니다.
      </div>
      <input
        value={code}
        onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
        placeholder="ARTM-XXXX"
        maxLength={9}
        style={{ width: "100%", padding: "14px", border: `2px solid ${error ? C.red : code.length >= 9 ? C.sage : C.light}`, borderRadius: 12, fontSize: 20, fontWeight: 700, letterSpacing: "0.12em", textAlign: "center", outline: "none", background: C.white, color: C.charcoal, marginBottom: 12 }}
      />
      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 12, textAlign: "center" }}>{error}</div>}
      <button
        onClick={submit}
        disabled={loading || code.length < 9}
        style={{ width: "100%", padding: 14, borderRadius: 12, background: loading || code.length < 9 ? C.light : C.terra, color: "white", border: "none", fontSize: 15, fontWeight: 700, cursor: loading || code.length < 9 ? "not-allowed" : "pointer" }}
      >
        {loading ? "연결 중…" : "연결하기"}
      </button>
    </BottomSheet>
  );
};

const LoginScreen=({role,onLogin,onBack,onVerifyInvite,onAdminSignIn,onAdminSignUp,logoSrc,isNativeApp,onExitApp})=>{
  const isDev = import.meta.env.DEV;
  const[email,setEmail]=useState("");
  const[pw,setPw]=useState("");
  const[loading,setLoading]=useState(false);
  const[done,setDone]=useState(false);
  const[error,setError]=useState("");
  const[isSignUp,setIsSignUp]=useState(false);

  const handleLogin=async()=>{
    if(!email.trim()||!pw.trim()){
      showAlert("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (isSignUp) await onAdminSignUp?.({ email: email.trim(), password: pw });
      else await onAdminSignIn?.({ email: email.trim(), password: pw });
      setDone(true);
      setTimeout(()=>onLogin(role),600);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (role === "parent") {
    return <ParentInviteLogin onLogin={onLogin} onBack={onBack} onVerifyInvite={onVerifyInvite} logoSrc={logoSrc} isNativeApp={isNativeApp} onExitApp={onExitApp}/>;
  }

  return(
    <div style={{display:"flex",flexDirection:"column",minHeight:"100%",background:`linear-gradient(160deg,${C.cream} 0%,${C.beige} 100%)`}}>
      {/* Header */}
      <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        {onBack
          ? <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.warm,display:"flex",alignItems:"center",gap:4}}>← 뒤로</button>
          : <div style={{width:48}}/>}
        {isNativeApp&&<button onClick={onExitApp} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:C.warm,fontWeight:600}}>앱 종료</button>}
      </div>

      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 28px 40px"}}>
        <img src={role==="admin"?APP_ICON_ADMIN:APP_ICON_PARENT} alt="앱 아이콘" style={{width:100,height:100,objectFit:"contain",borderRadius:22,boxShadow:"0 4px 16px rgba(61,53,48,0.15)",marginBottom:4}}/>
        <div style={{marginTop:8,marginBottom:36,fontSize:13,color:C.warm,textAlign:"center",lineHeight:1.6}}>
          {role==="admin"?"원장 로그인":"학부모 로그인"}
        </div>

        {done?(
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:12}}>✅</div>
            <div style={{fontSize:16,fontWeight:700,color:C.charcoal}}>로그인 성공!</div>
          </div>
        ):(
          <div style={{width:"100%"}}>
            {/* Email/PW */}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:12,color:C.warm,marginBottom:4}}>이메일</div>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder={isDev?(role==="admin"?"데모: admin@artmuse.kr":"데모: parent@artmuse.kr"):"이메일"}
                style={{width:"100%",padding:"12px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:14,outline:"none",background:C.white,color:C.charcoal}}/>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,color:C.warm,marginBottom:4}}>비밀번호</div>
              <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder={isDev?"데모: 아무 비밀번호":"비밀번호"}
                style={{width:"100%",padding:"12px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:14,outline:"none",background:C.white,color:C.charcoal}}/>
            </div>

            <button onClick={handleLogin} disabled={loading}
              style={{width:"100%",padding:"15px",borderRadius:12,background:loading?C.light:C.terra,color:"white",border:"none",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {loading?<><span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span>로그인 중...</>:isSignUp?"회원가입":"로그인"}
            </button>
            {error && <div style={{fontSize:12,color:C.red,marginTop:10,textAlign:"center"}}>{error}</div>}

            <div style={{textAlign:"center",marginTop:14,fontSize:12,color:C.warm}}>
              {isSignUp ? "이미 계정이 있으신가요? " : "계정이 없으신가요? "}
              <span onClick={()=>{setIsSignUp(!isSignUp);setError("");}} style={{color:C.terra,fontWeight:600,cursor:"pointer"}}>
                {isSignUp ? "로그인" : "회원가입"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TERMS_TEXT = `아트뮤즈(ArtMuse) 서비스 이용약관

제1조 (목적)
본 약관은 아트뮤즈가 제공하는 학원 관리 서비스의 이용 조건 및 절차를 규정합니다.

제2조 (서비스)
원장은 학생·작품·출결·수강료·공지 등 학원 운영 기능을 이용할 수 있으며, 학부모는 연결된 자녀 정보를 열람할 수 있습니다.

제3조 (계정)
계정 정보는 이용자가 안전하게 관리해야 하며, 타인에게 양도할 수 없습니다.

제4조 (데이터)
업로드된 작품 및 학원 데이터의 소유권은 해당 학원에 있습니다.`;

const PRIVACY_TEXT = `아트뮤즈 개인정보처리방침

1. 수집 항목: 학원명, 연락처, 학생·학부모 정보, 작품 이미지
2. 이용 목적: 학원 운영, 학부모 알림, 출결·수강료 관리
3. 보관 기간: 회원 탈퇴 또는 학원 해지 시까지
4. 제3자 제공: 법령에 따른 경우를 제외하고 제공하지 않습니다.
5. 문의: admin@artmuse.kr`;

const SettingsPage=({onBack,initTab="academy",academy,onSaveAcademy,onNavigate,onLogout,onWithdraw,onExportData,studentCount,plan,isMaster})=>{
  const[tab,setTab]=useState(initTab);
  const[academyName,setAcademyName]=useState(academy.name);
  const[tagline,setTagline]=useState(academy.tagline);
  const[phone,setPhone]=useState(academy.phone);
  const[addr,setAddr]=useState(academy.addr);
  const[email,setEmail]=useState(academy.email);
  const[bankName,setBankName]=useState(academy.bankName ?? "");
  const[bankAccount,setBankAccount]=useState(academy.bankAccount ?? "");
  const[logoPreview,setLogoPreview]=useState(academy.logoUrl);
  const[saved,setSaved]=useState(false);
  const[logoMsg,setLogoMsg]=useState("");
  const logoInputRef=useRef(null);

  const[notifs,setNotifs]=useState({...academy.notifs});
  const[showPwModal,setShowPwModal]=useState(false);
  const[pwForm,setPwForm]=useState({current:"",next:"",confirm:""});
  const[pwError,setPwError]=useState("");
  const[showDoc,setShowDoc]=useState(null);
  const[logoCropSrc,setLogoCropSrc]=useState(null);
  const[exportMsg,setExportMsg]=useState("");
  const[exporting,setExporting]=useState(false);

  useEffect(()=>{ setTab(initTab); }, [initTab]);
  useEffect(()=>{
    setAcademyName(academy.name);
    setTagline(academy.tagline);
    setPhone(academy.phone);
    setAddr(academy.addr);
    setEmail(academy.email);
    setBankName(academy.bankName ?? "");
    setBankAccount(academy.bankAccount ?? "");
    setLogoPreview(academy.logoUrl);
    setNotifs({...academy.notifs});
  }, [academy]);

  const toggleNotif=async(key)=>{
    const next={...notifs,[key]:!notifs[key]};
    setNotifs(next);
    try{
      await onSaveAcademy({notifs:next});
    }catch{ /* alert in onSaveAcademy */ }
  };

  const Toggle=({on,onToggle})=>(
    <div onClick={onToggle} style={{width:44,height:24,borderRadius:12,background:on?C.terra:C.light,cursor:"pointer",transition:"background .2s",position:"relative",flexShrink:0}}>
      <div style={{position:"absolute",top:2,left:on?22:2,width:20,height:20,borderRadius:10,background:"white",boxShadow:"0 1px 4px rgba(0,0,0,0.2)",transition:"left .2s"}}/>
    </div>
  );

  const flashSaved=()=>{
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const handleSave=async()=>{
    try{
      await onSaveAcademy({name:academyName,tagline,phone,addr,email,bankName,bankAccount,logoUrl:logoPreview});
      flashSaved();
    }catch{ /* alert in onSaveAcademy */ }
  };

  const handleLogoPick=e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    if(!file.type.startsWith("image/")){
      showAlert("PNG 또는 JPG 이미지 파일을 선택해 주세요.");
      return;
    }
    if(file.size>2*1024*1024){
      showAlert("2MB 이하 이미지만 업로드할 수 있습니다.");
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>setLogoCropSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value="";
  };

  const applyLogo=async(dataUrl)=>{
    setLogoPreview(dataUrl);
    try{
      await onSaveAcademy({logoUrl:dataUrl});
      setLogoCropSrc(null);
      setLogoMsg("로고가 변경되었습니다");
      setTimeout(()=>setLogoMsg(""),2000);
    }catch{
      setLogoPreview(academy.logoUrl);
    }
  };

  const handleAccountAction=async(id)=>{
    if(id==="password"){ setPwForm({current:"",next:"",confirm:""}); setPwError(""); setShowPwModal(true); return; }
    if(id==="parent_accounts"){ onNavigate("parent_accounts"); return; }
    if(id==="export"){
      setExporting(true);
      setExportMsg("");
      try{
        const r=await onExportData();
        if(r?.cancelled)return;
        setExportMsg(r?.method==="native"?"공유 메뉴에서 백업 파일을 저장하세요.":"백업 파일을 내보냈습니다.");
        setTimeout(()=>setExportMsg(""),3000);
      }catch(e){
        showAlert(e?.message||"백업 내보내기에 실패했습니다.");
      }finally{
        setExporting(false);
      }
      return;
    }
    if(id==="terms"){ setShowDoc("terms"); return; }
    if(id==="privacy"){ setShowDoc("privacy"); return; }
  };

  const handlePwSave=async()=>{
    if(!pwForm.current.trim()||!pwForm.next.trim()){
      setPwError("현재 비밀번호와 새 비밀번호를 입력해 주세요.");
      return;
    }
    if(pwForm.next.length<6){
      setPwError("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if(pwForm.next!==pwForm.confirm){
      setPwError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    try {
      const sb = requireSupabase();
      const { error } = await sb.auth.updateUser({ password: pwForm.next });
      if (error) throw error;
      setShowPwModal(false);
      setPwForm({ current: "", next: "", confirm: "" });
      flashSaved();
      showAlert("비밀번호가 변경되었습니다.");
    } catch (e) {
      setPwError(authErrorMessage(e));
    }
  };

  const handleLogout=()=>{
    if(window.confirm("로그아웃 하시겠습니까?")) onLogout();
  };

  const handleWithdraw=()=>{
    if(!window.confirm("회원 탈퇴 시 학원 데이터가 모두 삭제되며 복구할 수 없습니다.\n정말 탈퇴하시겠습니까?"))return;
    if(!window.confirm("탈퇴를 계속 진행하시겠습니까?"))return;
    onWithdraw?.();
  };

  const tabs=[{id:"academy",l:"학원 정보"},{id:"notif",l:"알림 설정"},{id:"account",l:"계정"}];
  const accountItems=[
    {id:"password",label:"비밀번호 변경"},
    {id:"parent_accounts",label:"학부모 계정 관리"},
    {id:"export",label:"데이터 백업 내보내기"},
    {id:"terms",label:"서비스 이용약관"},
    {id:"privacy",label:"개인정보처리방침"},
  ];

  return(
    <div>
      <div style={{background:`linear-gradient(160deg,${C.beige},${C.cream})`,padding:"16px 16px 0"}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:C.warm,marginBottom:16,display:"flex",alignItems:"center",gap:4}}>← 더보기</button>
        <div style={{fontSize:18,fontWeight:800,color:C.charcoal,marginBottom:16}}>설정</div>
      </div>

      <div style={{display:"flex",background:C.white,borderBottom:`1px solid ${C.beige}`}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"12px 0",border:"none",background:"none",fontSize:12,fontWeight:tab===t.id?700:400,color:tab===t.id?C.terra:C.warm,borderBottom:`2px solid ${tab===t.id?C.terra:"transparent"}`,cursor:"pointer"}}>{t.l}</button>
        ))}
      </div>

      <div style={{padding:16}}>
        {tab==="academy"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px"}}>
              <div style={{width:56,height:56,borderRadius:12,background:C.beige,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
                <img src={resolveLogoUrl(logoPreview)} alt="로고" style={{width:52,height:"auto",objectFit:"contain"}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>학원 로고</div>
                <div style={{fontSize:11,color:C.warm,marginTop:2}}>PNG / JPG · 권장 500×500 · 최대 2MB</div>
                {logoMsg&&<div style={{fontSize:11,color:C.sage,marginTop:4,fontWeight:600}}>✓ {logoMsg}</div>}
              </div>
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{display:"none"}} onChange={handleLogoPick}/>
              <button onClick={()=>logoInputRef.current?.click()} style={{padding:"6px 12px",borderRadius:20,background:C.beige,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",color:C.terra}}>변경</button>
            </Card>

            <Card style={{padding:0}}>
              {[
                {l:"학원명",v:academyName,set:setAcademyName},
                {l:"슬로건",v:tagline,set:setTagline,ph:"로그인·앱 상단에 표시"},
                {l:"대표 연락처",v:phone,set:setPhone},
                {l:"주소",v:addr,set:setAddr},
                {l:"이메일",v:email,set:setEmail},
                {l:"은행",v:bankName,set:setBankName,ph:"예: 국민은행"},
                {l:"계좌번호",v:bankAccount,set:setBankAccount,ph:"예: 123-456-789012"},
              ].map((f,i,arr)=>(
                <div key={f.l} style={{padding:"12px 16px",borderBottom:i<arr.length-1?`1px solid ${C.beige}`:"none"}}>
                  <div style={{fontSize:11,color:C.warm,marginBottom:4}}>{f.l}</div>
                  <input value={f.v} onChange={e=>f.set(e.target.value)} placeholder={f.ph||""}
                    style={{width:"100%",border:"none",background:"none",fontSize:14,color:C.charcoal,outline:"none",padding:0}}/>
                </div>
              ))}
            </Card>

            <Card style={{background:`linear-gradient(135deg,${C.terra},${C.terraD})`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.75)",marginBottom:4}}>현재 플랜</div>
                  {isMaster
                    ? <div style={{fontSize:15,fontWeight:800,color:"white"}}>🛠 개발자 계정 (Premium 전체 기능)</div>
                    : <div style={{fontSize:18,fontWeight:800,color:"white"}}>{PLANS[plan]?.label ?? "Free"} {plan==="free"?"(무료)":`₩${(PLANS[plan]?.price||0).toLocaleString()}/월`}</div>
                  }
                  {plan==="free"&&!isMaster&&<div style={{fontSize:12,color:"rgba(255,255,255,0.8)",marginTop:4}}>학생 최대 {PLANS.free.maxStudents}명 · 월 사진 {PLANS.free.maxPhotosPerMonth}장</div>}
                  {plan!=="free"&&!isMaster&&<div style={{fontSize:12,color:"rgba(255,255,255,0.8)",marginTop:4}}>무제한 학생 · 무제한 작품</div>}
                </div>
                <button onClick={()=>onNavigate?.("upgrade")} style={{padding:"8px 14px",borderRadius:20,background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",color:"white",fontSize:12,fontWeight:600,cursor:"pointer"}}>플랜 보기</button>
              </div>
              {plan==="free"&&!isMaster&&(
                <div style={{marginTop:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"rgba(255,255,255,0.75)"}}>학생</span><span style={{fontSize:11,color:"white",fontWeight:600}}>{studentCount} / {PLANS.free.maxStudents}명</span></div>
                  <div style={{height:6,background:"rgba(255,255,255,0.2)",borderRadius:3}}>
                    <div style={{height:"100%",borderRadius:3,background:"white",width:`${Math.min(100,Math.round(studentCount/PLANS.free.maxStudents*100))}%`}}/>
                  </div>
                </div>
              )}
            </Card>

            {saved&&(
              <div style={{textAlign:"center",padding:"10px",background:"#E8F4EA",borderRadius:10,fontSize:13,color:C.sage,fontWeight:600}}>✓ 저장되었습니다</div>
            )}
            <button onClick={handleSave} style={{width:"100%",padding:14,borderRadius:12,background:C.terra,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>저장</button>
          </div>
        )}

        {tab==="notif"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:12,color:C.warm,marginBottom:4}}>📱 앱 푸시 알림</div>
            <Card style={{padding:0}}>
              {[
                {key:"attendPush",   l:"출결 처리 알림", sub:"출결 처리 시 학부모에게 앱 알림 발송"},
                {key:"feedbackPush", l:"피드백 알림",    sub:"피드백 발송 시 학부모에게 앱 알림"},
                {key:"paymentRemind",l:"결제 예정 알림", sub:`납부 예정·미납 안내 (${feeNoticeWindowLabel()})`},
                {key:"noticePush",   l:"공지 알림",      sub:"공지 발송 시 학부모에게 앱 알림"},
              ].map((n,i,arr)=>(
                <div key={n.key} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:i<arr.length-1?`1px solid ${C.beige}`:"none"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:C.charcoal}}>{n.l}</div>
                    <div style={{fontSize:11,color:C.warm,marginTop:2}}>{n.sub}</div>
                  </div>
                  <Toggle on={notifs[n.key]} onToggle={()=>toggleNotif(n.key)}/>
                </div>
              ))}
            </Card>
            <div style={{fontSize:11,color:C.warm,textAlign:"center"}}>변경 사항은 자동으로 저장됩니다</div>
          </div>
        )}

        {tab==="account"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:56,height:56,borderRadius:28,background:`linear-gradient(135deg,${C.terra},${C.terraD})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:"white",fontWeight:700}}>원</div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.charcoal}}>원장</div>
                <div style={{fontSize:12,color:C.warm,marginTop:2}}>{academy.email}</div>
                <Badge color="terra" small>원장 계정</Badge>
              </div>
            </Card>

            <Card style={{padding:0}}>
              {accountItems.map((item,i,arr)=>(
                <div key={item.id} onClick={()=>!exporting&&handleAccountAction(item.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:i<arr.length-1?`1px solid ${C.beige}`:"none",cursor:exporting?"wait":"pointer",opacity:exporting&&item.id==="export"?0.6:1}}>
                  <span style={{fontSize:14,color:C.charcoal}}>{item.id==="export"&&exporting?"내보내는 중…":item.label}</span>
                  <span style={{color:C.light}}>›</span>
                </div>
              ))}
            </Card>
            {exportMsg&&(
              <div style={{textAlign:"center",padding:"10px",background:"#E8F4EA",borderRadius:10,fontSize:13,color:C.sage,fontWeight:600}}>✓ {exportMsg}</div>
            )}

            <button onClick={handleLogout} style={{width:"100%",padding:14,borderRadius:12,background:"#FDEAEA",color:C.red,border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>로그아웃</button>
            <button onClick={handleWithdraw} style={{width:"100%",padding:10,marginTop:4,borderRadius:12,background:"none",color:C.warm,border:"none",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>회원 탈퇴</button>
          </div>
        )}
      </div>

      <BottomSheet open={!!logoCropSrc} onClose={()=>setLogoCropSrc(null)} title="학원 로고 자르기">
        {logoCropSrc&&(
          <ImageCropEditor
            src={logoCropSrc}
            title="로고 영역 맞추기"
            fixedAspect={1}
            onApply={applyLogo}
            onSkip={()=>applyLogo(logoCropSrc)}
            onCancel={()=>setLogoCropSrc(null)}
          />
        )}
      </BottomSheet>

      <BottomSheet open={showPwModal} onClose={()=>setShowPwModal(false)} title="비밀번호 변경">
        {[{k:"current",l:"현재 비밀번호",ph:"현재 비밀번호"},{k:"next",l:"새 비밀번호",ph:"6자 이상"},{k:"confirm",l:"새 비밀번호 확인",ph:"다시 입력"}].map(f=>(
          <div key={f.k} style={{marginBottom:12}}>
            <div style={{fontSize:12,color:C.warm,marginBottom:4}}>{f.l}</div>
            <input type="password" value={pwForm[f.k]} onChange={e=>{setPwForm(p=>({...p,[f.k]:e.target.value}));setPwError("");}}
              placeholder={f.ph} style={{width:"100%",padding:"12px 14px",border:`1px solid ${C.light}`,borderRadius:10,fontSize:14,outline:"none"}}/>
          </div>
        ))}
        {pwError&&<div style={{fontSize:12,color:C.red,marginBottom:10}}>{pwError}</div>}
        <button onClick={handlePwSave} style={{width:"100%",padding:14,borderRadius:12,background:C.terra,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>변경하기</button>
      </BottomSheet>

      <BottomSheet open={!!showDoc} onClose={()=>setShowDoc(null)} title={showDoc==="terms"?"서비스 이용약관":"개인정보처리방침"}>
        <div style={{fontSize:13,color:C.charcoal,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{showDoc==="terms"?TERMS_TEXT:PRIVACY_TEXT}</div>
      </BottomSheet>
    </div>
  );
};

const ParentSettingsPage = ({
  profile,
  userEmail,
  pushEnabled,
  onTogglePush,
  onSaveProfile,
  onLogout,
  onWithdraw,
  linkedChildren = [],
  onAddChild,
}) => {
  const [tab, setTab] = useState("notif");
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [parentNotifs, setParentNotifs] = useState({
    attendPush: pushEnabled,
    feedbackPush: pushEnabled,
    paymentRemind: pushEnabled,
    noticePush: pushEnabled,
  });

  useEffect(() => {
    setFullName(profile?.fullName ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile?.fullName, profile?.phone]);

  useEffect(() => {
    setParentNotifs({
      attendPush: pushEnabled,
      feedbackPush: pushEnabled,
      paymentRemind: pushEnabled,
      noticePush: pushEnabled,
    });
  }, [pushEnabled]);

  const Toggle = ({ on, onToggle }) => (
    <div onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, background: on ? C.terra : C.light, cursor: "pointer", transition: "background .2s", position: "relative", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "left .2s" }} />
    </div>
  );

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleNotif = async (key) => {
    const nextVal = !parentNotifs[key];
    const next = { ...parentNotifs, [key]: nextVal };
    setParentNotifs(next);
    const anyOn = Object.values(next).some(Boolean);
    await onTogglePush(anyOn);
  };

  const handleSaveProfile = async () => {
    await onSaveProfile({ fullName: fullName.trim(), phone: phone.trim() });
    flashSaved();
  };

  const handlePwSave = () => {
    if (!pwForm.current.trim() || !pwForm.next.trim()) {
      setPwError("현재 비밀번호와 새 비밀번호를 입력해 주세요.");
      return;
    }
    if (pwForm.next.length < 6) {
      setPwError("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setShowPwModal(false);
    flashSaved();
    showAlert("비밀번호가 변경되었습니다.");
  };

  const handleLogout = () => {
    if (window.confirm("로그아웃 하시겠습니까?")) onLogout();
  };

  const handleWithdraw = () => {
    if (!window.confirm("탈퇴 시 연결된 자녀 정보가 학원에서 삭제되며 복구할 수 없습니다.\n정말 탈퇴하시겠습니까?")) return;
    if (!window.confirm("탈퇴를 계속 진행하시겠습니까?")) return;
    onWithdraw?.();
  };

  const tabs = [{ id: "notif", l: "알림 설정" }, { id: "profile", l: "개인정보" }, { id: "account", l: "계정" }];
  const displayName = fullName || userEmail?.split("@")[0] || "학부모";

  return (
    <div>
      <div style={{ background: `linear-gradient(160deg,${C.beige},${C.cream})`, padding: "16px 16px 0" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.charcoal, marginBottom: 16 }}>설정</div>
      </div>

      <div style={{ display: "flex", background: C.white, borderBottom: `1px solid ${C.beige}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "12px 0", border: "none", background: "none", fontSize: 12, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? C.terra : C.warm, borderBottom: `2px solid ${tab === t.id ? C.terra : "transparent"}`, cursor: "pointer" }}>{t.l}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {tab === "notif" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: C.warm, marginBottom: 4 }}>📱 앱 푸시 알림</div>
            <Card style={{ padding: 0 }}>
              {[
                { key: "attendPush", l: "출결 알림", sub: "자녀 출결 처리 시 알림" },
                { key: "feedbackPush", l: "피드백 알림", sub: "선생님 피드백 수신 시 알림" },
                { key: "paymentRemind", l: "수강료 알림", sub: `납부 예정·미납 안내 (${feeNoticeWindowLabel()})` },
                { key: "noticePush", l: "공지 알림", sub: "학원 공지 발송 시 알림" },
              ].map((n, i, arr) => (
                <div key={n.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${C.beige}` : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.charcoal }}>{n.l}</div>
                    <div style={{ fontSize: 11, color: C.warm, marginTop: 2 }}>{n.sub}</div>
                  </div>
                  <Toggle on={parentNotifs[n.key]} onToggle={() => toggleNotif(n.key)} />
                </div>
              ))}
            </Card>
            <div style={{ fontSize: 11, color: C.warm, textAlign: "center" }}>변경 사항은 자동으로 저장됩니다</div>
          </div>
        )}

        {tab === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {linkedChildren.length > 0 && (
              <Card style={{ padding: 0 }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.beige}` }}>
                  <div style={{ fontSize: 12, color: C.warm, fontWeight: 600 }}>연결된 자녀 ({linkedChildren.length}명)</div>
                </div>
                {linkedChildren.map((child, i) => (
                  <div key={child.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < linkedChildren.length - 1 ? `1px solid ${C.beige}` : "none" }}>
                    <span style={{ fontSize: 24 }}>{child.art}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.charcoal }}>{child.name}</div>
                      <div style={{ fontSize: 11, color: C.warm, marginTop: 2 }}>{child.school} · {child.grade}</div>
                    </div>
                  </div>
                ))}
                {onAddChild && (
                  <button
                    type="button"
                    onClick={onAddChild}
                    style={{ width: "100%", padding: "12px 16px", border: "none", background: C.cream, color: C.terra, fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                  >
                    + 다른 자녀 연결하기
                  </button>
                )}
              </Card>
            )}
            <Card style={{ padding: 0 }}>
              {[
                { l: "이름", v: fullName, set: setFullName, ph: "학부모 이름" },
                { l: "연락처", v: phone, set: setPhone, ph: "010-0000-0000" },
                { l: "이메일", v: userEmail ?? "", set: null, ro: true },
              ].map((f, i, arr) => (
                <div key={f.l} style={{ padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${C.beige}` : "none" }}>
                  <div style={{ fontSize: 11, color: C.warm, marginBottom: 4 }}>{f.l}</div>
                  {f.ro ? (
                    <div style={{ fontSize: 14, color: C.warm }}>{f.v}</div>
                  ) : (
                    <input value={f.v} onChange={e => f.set(e.target.value)} placeholder={f.ph || ""}
                      style={{ width: "100%", border: "none", background: "none", fontSize: 14, color: C.charcoal, outline: "none", padding: 0 }} />
                  )}
                </div>
              ))}
            </Card>
            {saved && (
              <div style={{ textAlign: "center", padding: "10px", background: "#E8F4EA", borderRadius: 10, fontSize: 13, color: C.sage, fontWeight: 600 }}>✓ 저장되었습니다</div>
            )}
            <button onClick={handleSaveProfile} style={{ width: "100%", padding: 14, borderRadius: 12, background: C.terra, color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>저장</button>
          </div>
        )}

        {tab === "account" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 28, background: `linear-gradient(135deg,${C.sage},${C.sageL})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "white", fontWeight: 700 }}>{displayName[0]}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.charcoal }}>{displayName}</div>
                <div style={{ fontSize: 12, color: C.warm, marginTop: 2 }}>{userEmail}</div>
                <Badge color="green" small>학부모 계정</Badge>
              </div>
            </Card>

            <Card style={{ padding: 0 }}>
              <div onClick={() => { setPwForm({ current: "", next: "", confirm: "" }); setPwError(""); setShowPwModal(true); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer" }}>
                <span style={{ fontSize: 14, color: C.charcoal }}>비밀번호 변경</span>
                <span style={{ color: C.light }}>›</span>
              </div>
            </Card>

            <button onClick={handleLogout} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#FDEAEA", color: C.red, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>로그아웃</button>
            <button onClick={handleWithdraw} style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 12, background: "none", color: C.warm, border: "none", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>회원 탈퇴</button>
          </div>
        )}
      </div>

      <BottomSheet open={showPwModal} onClose={() => setShowPwModal(false)} title="비밀번호 변경">
        {[{ k: "current", l: "현재 비밀번호", ph: "현재 비밀번호" }, { k: "next", l: "새 비밀번호", ph: "6자 이상" }, { k: "confirm", l: "새 비밀번호 확인", ph: "다시 입력" }].map(f => (
          <div key={f.k} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.warm, marginBottom: 4 }}>{f.l}</div>
            <input type="password" value={pwForm[f.k]} onChange={e => { setPwForm(p => ({ ...p, [f.k]: e.target.value })); setPwError(""); }}
              placeholder={f.ph} style={{ width: "100%", padding: "12px 14px", border: `1px solid ${C.light}`, borderRadius: 10, fontSize: 14, outline: "none" }} />
          </div>
        ))}
        {pwError && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{pwError}</div>}
        <button onClick={handlePwSave} style={{ width: "100%", padding: 14, borderRadius: 12, background: C.terra, color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>변경하기</button>
      </BottomSheet>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// OFFLINE ATTENDANCE STORE (IndexedDB-like, in-memory for demo)
// 실제: idb 라이브러리 + Background Sync API 사용
// ══════════════════════════════════════════════════════════════

// 오프라인 큐 — useArtlogAppState.js 에서 관리

// 네트워크 상태는 useArtlogAppState → network 사용 (App 컴포넌트)

// ══════════════════════════════════════════════════════════════
// OFFLINE BANNER
// ══════════════════════════════════════════════════════════════
const OfflineBanner = ({ online, queueLen, syncCount, onToggle }) => {
  const [showSync, setShowSync] = useState(false);

  useEffect(() => {
    if (online && syncCount > 0) {
      setShowSync(true);
      const t = setTimeout(() => setShowSync(false), 3000);
      return () => clearTimeout(t);
    }
  }, [online, syncCount]);

  if (online && !showSync) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 300,
      background: showSync ? C.sage : '#3D3530',
      color: 'white',
      padding: '8px 16px',
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'slideDown .3s ease',
      fontSize: 12,
    }}>
      {showSync ? (
        <>
          <span style={{fontSize:16}}>✅</span>
          <span style={{fontWeight:600}}>동기화 완료! {syncCount}건이 서버에 저장되었습니다</span>
        </>
      ) : (
        <>
          <span style={{fontSize:16}}>📡</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700}}>오프라인 모드</div>
            <div style={{fontSize:10,opacity:0.8}}>출결은 기기에 저장 후 온라인 시 자동 동기화됩니다{queueLen>0?` (대기 ${queueLen}건)`:''}</div>
          </div>
          <button onClick={onToggle} style={{padding:'4px 10px',borderRadius:12,background:'rgba(255,255,255,0.2)',border:'none',color:'white',fontSize:10,cursor:'pointer',fontWeight:600}}>
            온라인 전환 (테스트)
          </button>
        </>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// OFFLINE-AWARE ATTEND MODAL
// ══════════════════════════════════════════════════════════════
const OfflineAttendModal = ({ student, online, onClose, onSave }) => {
  const sessionTime = student.attendTime ?? student.classTime ?? "15:00";
  const [sel, setSel] = useState(student.attendStatus ?? student.status ?? null);
  const [done, setDone] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  const opts = [
    {id:'present',label:'✅ 출석',c:C.sage, bg:'#E8F4EA'},
    {id:'late',   label:'⏰ 지각',c:C.gold, bg:'#FDF5E0'},
    {id:'absent', label:'❌ 결석',c:C.red,  bg:'#FDEAEA'},
    {id:'makeup', label:'🔄 보강',c:C.blue, bg:'#E8EFF5'},
  ];

  const save = () => {
    if (!sel) return;
    const payload = {
      student_id: student.id,
      student_name: student.name,
      status: sel,
      class_time: sessionTime,
      date: new Date().toISOString().slice(0,10),
      checked_at: new Date().toISOString(),
    };

    if (!online) {
      enqueueAttendance(payload);
      setSavedOffline(true);
      setTimeout(() => { onSave(student.id, sel, sessionTime); }, 1000);
    } else {
      setDone(true);
      setTimeout(() => { onSave(student.id, sel, sessionTime); }, 900);
    }
  };

  if (savedOffline) return (
    <BottomSheet open onClose={onClose}>
      <div style={{textAlign:'center',padding:'16px 0'}}>
        <div style={{fontSize:48,marginBottom:10}}>💾</div>
        <div style={{fontSize:17,fontWeight:700,color:C.charcoal}}>기기에 저장됨</div>
        <div style={{fontSize:13,color:C.warm,marginTop:6,lineHeight:1.7}}>
          오프라인 상태입니다.<br/>온라인 연결 시 자동으로 서버에 동기화됩니다.
        </div>
        <div style={{marginTop:14,padding:'8px 14px',background:C.beige,borderRadius:10,fontSize:12,color:C.warm,display:'inline-block'}}>
          📡 대기 중...
        </div>
      </div>
    </BottomSheet>
  );

  if (done) return (
    <BottomSheet open onClose={onClose}>
      <div style={{textAlign:'center',padding:'16px 0'}}>
        <div style={{fontSize:48,marginBottom:10}}>{{present:'✅',late:'⏰',absent:'❌',makeup:'🔄'}[sel]}</div>
        <div style={{fontSize:17,fontWeight:700,color:C.charcoal}}>저장 완료!</div>
        <div style={{fontSize:13,color:C.warm,marginTop:4}}>학부모 앱으로 출결 알림이 전달됩니다</div>
      </div>
    </BottomSheet>
  );

  return (
    <BottomSheet open onClose={onClose}>
      {!online && (
        <div style={{background:'#3D3530',color:'white',borderRadius:10,padding:'8px 12px',marginBottom:14,fontSize:12,display:'flex',alignItems:'center',gap:8}}>
          <span>📡</span><span>오프라인 — 저장 후 자동 동기화됩니다</span>
        </div>
      )}
      <div style={{textAlign:'center',marginBottom:20}}>
        <div style={{fontSize:40,marginBottom:8}}>{student.art}</div>
        <div style={{fontSize:18,fontWeight:700,color:C.charcoal}}>{student.name}</div>
        <div style={{fontSize:12,color:C.warm}}>{student.school} {student.grade}</div>
        <Badge color="blue" small>{student.isMakeupSession?"🔄 보강":"🕐"} {sessionTime} 수업</Badge>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
        {opts.map(o=>(
          <button key={o.id} onClick={()=>setSel(o.id)} style={{padding:14,borderRadius:12,border:`2px solid ${sel===o.id?o.c:'transparent'}`,background:sel===o.id?o.bg:C.beige,fontSize:15,fontWeight:700,cursor:'pointer',color:sel===o.id?o.c:C.warm,transition:'all .15s'}}>{o.label}</button>
        ))}
      </div>
      <button onClick={save} disabled={!sel} style={{width:'100%',padding:16,background:sel?(online?C.terra:'#3D3530'):C.light,color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:sel?'pointer':'not-allowed',transition:'background .2s'}}>
        {online ? '저장 + 학부모 알림 발송' : '💾 기기에 저장 (오프라인)'}
      </button>
    </BottomSheet>
  );
};

// ══════════════════════════════════════════════════════════════
// OFFLINE QUEUE VIEWER
// ══════════════════════════════════════════════════════════════
const OfflineQueuePage = ({ onBack, online, queueLen, onGoOnline }) => {
  const [items, setItems] = useState([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsub = subscribeQueue(setItems);
    return unsub;
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await onGoOnline();
    setSyncing(false);
  };

  return (
    <div style={{padding:'0 16px 16px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'16px 0'}}>
        <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,color:C.warm}}>←</button>
        <div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>동기화 대기열</div>
      </div>

      {/* Status card */}
      <Card style={{background: online ? `linear-gradient(135deg,${C.sage},${C.sageL})` : 'linear-gradient(135deg,#3D3530,#5C4A40)', marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:48,height:48,borderRadius:24,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>
            {online ? '🌐' : '📡'}
          </div>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:'white'}}>{online ? '온라인 상태' : '오프라인 모드'}</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.8)',marginTop:2}}>
              {online ? '모든 데이터가 실시간 동기화됩니다' : `대기 중인 출결 ${items.length}건`}
            </div>
          </div>
        </div>
        {!online && items.length > 0 && (
          <button onClick={handleSync} disabled={syncing} style={{width:'100%',marginTop:14,padding:'10px',borderRadius:10,background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.3)',color:'white',fontSize:13,fontWeight:700,cursor:syncing?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            {syncing ? <><span style={{display:'inline-block',animation:'spin 1s linear infinite'}}>⟳</span> 동기화 중...</> : '🔄 지금 동기화 (온라인 전환)'}
          </button>
        )}
      </Card>

      {/* How it works */}
      <Card style={{marginBottom:16,border:`1px solid ${C.beige}`}}>
        <div style={{fontSize:13,fontWeight:700,color:C.charcoal,marginBottom:10}}>⚙️ 동작 방식</div>
        {[
          {icon:'📡',title:'오프라인 감지',desc:'네트워크 끊김 시 자동으로 오프라인 모드 전환'},
          {icon:'💾',title:'기기 저장',    desc:'출결 데이터를 기기(IndexedDB)에 즉시 저장'},
          {icon:'🔄',title:'자동 동기화', desc:'온라인 복귀 시 Background Sync로 서버에 자동 전송'},
          {icon:'✅',title:'충돌 방지',   desc:'서버 데이터 우선, 오프라인 데이터는 보완'},
        ].map((s,i,arr)=>(
          <div key={s.icon} style={{display:'flex',gap:10,paddingBottom:i<arr.length-1?10:0,marginBottom:i<arr.length-1?10:0,borderBottom:i<arr.length-1?`1px solid ${C.beige}`:'none'}}>
            <div style={{width:32,height:32,borderRadius:8,background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{s.icon}</div>
            <div><div style={{fontSize:12,fontWeight:700,color:C.charcoal}}>{s.title}</div><div style={{fontSize:11,color:C.warm,marginTop:2,lineHeight:1.5}}>{s.desc}</div></div>
          </div>
        ))}
      </Card>

      {/* Queue items */}
      <SecTitle>대기 중인 출결 ({items.length}건)</SecTitle>
      {items.length === 0 ? (
        <Card style={{textAlign:'center',padding:'28px 0',color:C.warm,fontSize:13}}>
          대기 중인 데이터가 없습니다 ✓
        </Card>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {items.map(item=>{
            const st=STUDENTS.find(s=>s.id===item.student_id);
            return(
              <Card key={item.id} style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:40,height:40,borderRadius:20,background:`linear-gradient(135deg,${C.beige},${C.sand})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{st?.art??'👤'}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>{item.student_name}</div>
                  <div style={{fontSize:11,color:C.warm,marginTop:2}}>{item.date} · <StatusChip s={item.status}/></div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
                  <Badge color="gold" small>대기중</Badge>
                  <div style={{fontSize:10,color:C.warm}}>{item.queuedAt.slice(11,16)}</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// PARENT INVITE SHARE (학부모 인증 문구 전달)
// ══════════════════════════════════════════════════════════════
const ParentInviteShareSheet = ({ invite, academyName, onClose }) => {
  const [copied, setCopied] = useState(false);
  const message = buildParentInviteMessage(invite.code, invite.studentName, academyName);

  const handleCopy = async () => {
    const ok = await copyToClipboard(message);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      showAlert("복사에 실패했습니다. 문구를 길게 눌러 직접 복사해 주세요.");
    }
  };

  return (
    <BottomSheet open onClose={onClose} title="학부모 인증 문구">
      <div style={{fontSize:13,color:C.warm,marginBottom:12,lineHeight:1.6}}>
        아래 문구를 학부모에게 전달해 주세요. 학부모는 앱 설치 후 인증코드를 입력하면 연결됩니다.
      </div>
      <Card style={{background:C.beige,marginBottom:14}}>
        <div style={{fontSize:12,color:C.warm,marginBottom:8}}>{invite.studentName} · {invite.code}</div>
        <div style={{fontSize:13,color:C.charcoal,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{message}</div>
      </Card>
      <button onClick={handleCopy} style={{width:"100%",padding:14,borderRadius:12,background:copied?C.sage:C.terra,color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>
        {copied ? "✓ 클립보드에 복사됨" : "클립보드에 복사"}
      </button>
      <button onClick={onClose} style={{width:"100%",padding:12,marginTop:8,borderRadius:12,background:C.beige,color:C.warm,border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>
        닫기
      </button>
    </BottomSheet>
  );
};

// ══════════════════════════════════════════════════════════════
// PARENT ACCOUNT MANAGER (원장 화면)
// ══════════════════════════════════════════════════════════════
const ParentAccountManager = ({ students, linkedParents, disconnectedParents, invites, onCreateInvite, onUnlinkParent, onBack, academyName }) => {
  const [tab, setTab] = useState('linked');

  const [showInvite, setShowInvite] = useState(false);
  const [shareInvite, setShareInvite] = useState(null);
  const [selStudent, setSelStudentInvite] = useState(null);
  const [copied, setCopied] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const linkedStudentIds = useMemo(
    () => new Set(linkedParents.map((p) => String(p.studentId))),
    [linkedParents]
  );
  const groupedLinkedParents = useMemo(
    () => groupLinkedParentsByAccount(linkedParents),
    [linkedParents]
  );
  const unlinkedStudentCount = useMemo(
    () => students.filter((s) => !linkedStudentIds.has(String(s.id))).length,
    [students, linkedStudentIds]
  );

  const unlinkedStudents = students.filter(s =>
    !linkedStudentIds.has(String(s.id)) &&
    !invites.filter(i=>!i.used && new Date(`${i.expiresAt}T23:59:59`) > new Date()).some(i => String(i.studentId) === String(s.id))
  );

  const generateInvite = async () => {
    if (!selStudent) return;
    try {
      await onCreateInvite(selStudent);
      setSelStudentInvite(null);
      setShowInvite(false);
      setTab('invite');
    } catch (e) {
      showAlert(e?.message || "초대 코드 생성에 실패했습니다.");
    }
  };

  const copyCode = async (code) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const deleteParent = async (parent) => {
    try {
      await onUnlinkParent(parent);
      setShowDeleteConfirm(null);
    } catch {
      /* alert in handler */
    }
  };

  const tabs = [
    { id: 'linked', l: `연결됨 ${groupedLinkedParents.length}` },
    { id: 'disconnected', l: `연결 해제 ${disconnectedParents.length}` },
    { id: 'invite', l: `초대 ${invites.filter(i => !i.used).length}` },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{background:`linear-gradient(160deg,${C.beige},${C.cream})`,padding:'16px 16px 0'}}>
        <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,color:C.warm,marginBottom:16,display:'flex',alignItems:'center',gap:4}}>← 더보기</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:0,paddingBottom:0}}>
          <div style={{fontSize:18,fontWeight:800,color:C.charcoal}}>학부모 계정 관리</div>
          <button onClick={()=>setShowInvite(true)} style={{background:C.terra,color:'white',border:'none',borderRadius:20,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>+ 초대 링크</button>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',marginTop:16,borderBottom:`1px solid ${C.beige}`}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:'12px 0',border:'none',background:'none',fontSize:12,fontWeight:tab===t.id?700:400,color:tab===t.id?C.terra:C.warm,borderBottom:`2px solid ${tab===t.id?C.terra:'transparent'}`,cursor:'pointer'}}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{padding:16}}>
        {/* ── 연결된 학부모 탭 ── */}
        {tab==='linked'&&(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {groupedLinkedParents.length===0 && (
              <Card style={{textAlign:'center',padding:'40px 0',color:C.warm,fontSize:13}}>
                연결된 학부모가 없습니다<br/>
                <span onClick={()=>setShowInvite(true)} style={{color:C.terra,fontWeight:600,cursor:'pointer'}}>초대 링크 생성하기 →</span>
              </Card>
            )}
            {groupedLinkedParents.map(group=>(
              <Card key={group.key}>
                <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:10}}>
                  <div style={{width:44,height:44,borderRadius:22,background:`linear-gradient(135deg,${C.terra},${C.terraD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'white',fontWeight:700,flexShrink:0}}>
                    {group.name[0]}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{group.name}</div>
                    <div style={{fontSize:12,color:C.warm,marginTop:1}}>{group.phone || '연락처 없음'}</div>
                    {group.children.length > 1 && (
                      <div style={{fontSize:11,color:C.sage,marginTop:4}}>자녀 {group.children.length}명 연결</div>
                    )}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {group.children.map(child=>(
                    <div key={child.linkId} style={{background:C.beige,borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:22}}>{child.studentArt}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:C.charcoal}}>{child.studentName}</div>
                        <div style={{fontSize:11,color:C.warm,marginTop:1}}>연결 자녀</div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{display:'flex',alignItems:'center',gap:4}}>
                          <div style={{width:8,height:8,borderRadius:4,background:child.fcm?C.sage:C.light}}/>
                          <span style={{fontSize:10,color:child.fcm?C.sage:C.warm}}>{child.fcm?'알림 ON':'알림 OFF'}</span>
                        </div>
                        <button
                          onClick={()=>setShowDeleteConfirm({
                            id: child.linkId,
                            linkIds: child.linkIds ?? [child.linkId],
                            name: group.name,
                            phone: group.phone,
                            studentId: child.studentId,
                            studentName: child.studentName,
                            studentArt: child.studentArt,
                          })}
                          style={{padding:'4px 10px',borderRadius:8,background:'#FDEAEA',color:C.red,border:'none',fontSize:11,fontWeight:600,cursor:'pointer',flexShrink:0}}
                        >
                          연결 해제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11,color:C.warm,marginTop:8}}>가입일 {group.joinedAt}</div>
              </Card>
            ))}

            {/* Stats */}
            <Card style={{background:C.beige}}>
              <div style={{fontSize:12,color:C.warm,marginBottom:10}}>연결 현황</div>
              <div style={{display:'flex',gap:16}}>
                {[
                  {l:'학부모',v:groupedLinkedParents.length,c:C.terra},
                  {l:'연결 학생',v:linkedStudentIds.size,c:C.sage},
                  {l:'미연결',v:unlinkedStudentCount,c:C.red},
                  {l:'알림 수신',v:groupedLinkedParents.filter(g=>g.children.some(c=>c.fcm)).length,c:C.blue},
                ].map(s=>(
                  <div key={s.l} style={{textAlign:'center',flex:1}}>
                    <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:10,color:C.warm,marginTop:2}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab==='disconnected'&&(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {disconnectedParents.length===0 && (
              <Card style={{textAlign:'center',padding:'40px 0',color:C.warm,fontSize:13}}>
                연결 해제된 학부모가 없습니다
              </Card>
            )}
            {disconnectedParents.map(p=>(
              <Card key={p.id} style={{opacity:0.85,border:`1px solid ${C.light}`}}>
                <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:10}}>
                  <div style={{width:44,height:44,borderRadius:22,background:C.light,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:C.warm,fontWeight:700,flexShrink:0}}>
                    {p.name[0]}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{p.name}</div>
                    <div style={{fontSize:12,color:C.warm,marginTop:1}}>{p.phone || '연락처 없음'}</div>
                  </div>
                  <Badge color="warm" small>연결 해제</Badge>
                </div>
                <div style={{background:C.beige,borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:22}}>{p.studentArt}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.charcoal}}>{p.studentName}</div>
                    <div style={{fontSize:11,color:C.warm,marginTop:1}}>연결 자녀 (삭제됨)</div>
                  </div>
                </div>
                <div style={{fontSize:11,color:C.warm,marginTop:8}}>
                  가입 {p.joinedAt || '-'} · 해제 {p.disconnectedAt}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── 초대 코드 탭 ── */}
        {tab==='invite'&&(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {/* How invite works */}
            <Card style={{background:'#FFF8F3',border:`1px solid ${C.terraL}`,marginBottom:4}}>
              <div style={{fontSize:12,color:C.terra,fontWeight:700,marginBottom:6}}>💡 초대 방법</div>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {['① + 초대 링크 버튼으로 자녀 선택 후 코드 생성','② 전달하기로 인증 문구를 학부모에게 공유','③ 학부모가 로그인 화면에서 코드 입력 → 자동 연결','④ 코드 유효기간 7일 · 연결 후에도 재로그인 가능'].map(s=>(
                  <div key={s} style={{fontSize:12,color:C.warm}}>{s}</div>
                ))}
              </div>
            </Card>

            {invites.length===0 && (
              <Card style={{textAlign:'center',padding:'40px 0',color:C.warm,fontSize:13}}>
                생성된 초대 코드가 없습니다
              </Card>
            )}

            {invites.map(inv=>{
              const expired = isInviteExpired(inv);
              return(
                <Card key={inv.id} style={{opacity:inv.used||expired?0.6:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <span style={{fontSize:24}}>{inv.studentArt}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.charcoal}}>{inv.studentName}</div>
                      <div style={{fontSize:11,color:C.warm,marginTop:1}}>만료 {inv.expiresAt}</div>
                    </div>
                    {inv.used ? <Badge color="green" small>사용됨</Badge>
                     : expired ? <Badge color="red" small>만료</Badge>
                     : <Badge color="terra" small>유효</Badge>}
                  </div>

                  {/* Code display */}
                  <div style={{background:C.beige,borderRadius:10,padding:'12px 14px',display:'flex',alignItems:'center',gap:10}}>
                    <div style={{flex:1,fontFamily:'monospace',fontSize:20,fontWeight:800,color:C.charcoal,letterSpacing:'0.1em'}}>{inv.code}</div>
                    {!inv.used&&!expired&&(
                      <button onClick={()=>copyCode(inv.code)} style={{padding:'6px 12px',borderRadius:8,background:copied===inv.code?C.sage:C.terra,color:'white',border:'none',fontSize:12,fontWeight:600,cursor:'pointer',transition:'background .2s'}}>
                        {copied===inv.code?'✓ 복사됨':'복사'}
                      </button>
                    )}
                  </div>

                  {!inv.used&&!expired&&(
                    <button onClick={() => setShareInvite(inv)} style={{width:"100%",marginTop:10,padding:10,borderRadius:8,background:C.terra,color:"white",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                      전달하기
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Generate invite modal */}
      <BottomSheet open={showInvite} onClose={()=>setShowInvite(false)} title="초대 링크 생성">
        <div style={{fontSize:13,color:C.warm,marginBottom:14}}>초대할 학생의 학부모를 연결합니다</div>
        {unlinkedStudents.length===0 ? (
          <div style={{textAlign:'center',padding:'20px 0',color:C.warm,fontSize:13}}>
            모든 학생의 학부모가 이미 연결되어 있습니다 ✓
          </div>
        ) : (
          <>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16,maxHeight:220,overflowY:'auto'}}>
              {unlinkedStudents.map(s=>(
                <div key={s.id} onClick={()=>setSelStudentInvite(s)} style={{display:'flex',alignItems:'center',gap:12,padding:12,borderRadius:12,border:`2px solid ${selStudent?.id===s.id?C.terra:'transparent'}`,background:selStudent?.id===s.id?'#FFF5EE':C.beige,cursor:'pointer'}}>
                  <span style={{fontSize:26}}>{s.art}</span>
                  <div><div style={{fontSize:14,fontWeight:700,color:C.charcoal}}>{s.name}</div><div style={{fontSize:11,color:C.warm}}>{s.school} {s.grade}</div></div>
                  {selStudent?.id===s.id&&<span style={{marginLeft:'auto',color:C.terra,fontWeight:700}}>✓</span>}
                </div>
              ))}
            </div>
            <button onClick={generateInvite} disabled={!selStudent} style={{width:'100%',padding:14,borderRadius:12,background:selStudent?C.terra:C.light,color:'white',border:'none',fontSize:14,fontWeight:700,cursor:selStudent?'pointer':'not-allowed'}}>
              초대 코드 생성 (유효기간 7일)
            </button>
          </>
        )}
      </BottomSheet>

      {shareInvite && (
        <ParentInviteShareSheet invite={shareInvite} academyName={academyName} onClose={() => setShareInvite(null)} />
      )}

      {/* Delete confirm */}
      <BottomSheet open={!!showDeleteConfirm} onClose={()=>setShowDeleteConfirm(null)}>
        {showDeleteConfirm&&(
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
            <div style={{fontSize:16,fontWeight:700,color:C.charcoal,marginBottom:8}}>{showDeleteConfirm.name}님 연결을 해제할까요?</div>
            <div style={{fontSize:13,color:C.warm,marginBottom:20,lineHeight:1.7}}>
              {showDeleteConfirm.studentName} 학생이 목록에서도 삭제되며,<br/>학부모는 더 이상 작품·피드백을 볼 수 없습니다
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowDeleteConfirm(null)} style={{flex:1,padding:13,borderRadius:12,background:C.beige,border:'none',fontSize:14,cursor:'pointer',color:C.charcoal}}>취소</button>
              <button onClick={()=>deleteParent(showDeleteConfirm)} style={{flex:1,padding:13,borderRadius:12,background:C.red,color:'white',border:'none',fontSize:14,fontWeight:700,cursor:'pointer'}}>연결 해제</button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// MODE SELECT
// ══════════════════════════════════════════════════════════════
const ModeSelect=({onSelectRole,logoSrc,tagline,isNativeApp,onExitApp})=>(
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100%",padding:"40px 24px",background:`linear-gradient(160deg,${C.cream},${C.beige})`}}>
    <div style={{display:"flex",gap:16,marginBottom:4}}>
      <img src={APP_ICON_ADMIN} alt="원장" style={{width:80,height:80,objectFit:"contain",borderRadius:18,boxShadow:"0 4px 16px rgba(61,53,48,0.15)"}}/>
      <img src={APP_ICON_PARENT} alt="학부모" style={{width:80,height:80,objectFit:"contain",borderRadius:18,boxShadow:"0 4px 16px rgba(61,53,48,0.15)"}}/>
    </div>
    <div style={{fontSize:13,color:C.warm,marginTop:10,marginBottom:48,textAlign:"center",lineHeight:1.6}}>{tagline.split(", ").join("\n")}</div>
    <div style={{display:"flex",flexDirection:"column",gap:14,width:"100%"}}>
      <button onClick={()=>onSelectRole("admin")} style={{padding:18,borderRadius:16,background:C.terra,color:"white",border:"none",fontSize:16,fontWeight:800,cursor:"pointer",boxShadow:`0 8px 24px rgba(193,127,91,0.35)`,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
        <span style={{fontSize:24}}>🎨</span> 원장 로그인
      </button>
      <button onClick={()=>onSelectRole("parent")} style={{padding:18,borderRadius:16,background:C.white,color:C.charcoal,border:`2px solid ${C.sand}`,fontSize:16,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
        <span style={{fontSize:24}}>👨‍👩‍👧</span> 학부모 로그인
      </button>
    </div>
    <div style={{marginTop:40,fontSize:11,color:C.light}}>ArtMuse v1.0.0</div>
    {isNativeApp&&(
      <button onClick={onExitApp} style={{marginTop:16,padding:"8px 18px",borderRadius:20,background:"transparent",border:`1px solid ${C.sand}`,fontSize:12,fontWeight:600,cursor:"pointer",color:C.warm}}>
        앱 종료
      </button>
    )}
  </div>
);

// ══════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════
export default function App(){
  const[alertMsg,setAlertMsg]    = useState(null);
  // 공유 showAlert을 이 모달 setter와 연결
  useEffect(()=>{
    wireShowAlert((msg)=>setAlertMsg(String(msg??"")));
    return()=>wireShowAlert((msg)=>window.alert(msg));
  },[]);

  const[mode,setMode]            = useState(initialAppMode);
  const[adminTab,setAdminTab]    = useState("home");
  const[parentTab,setParentTab]  = useState("phome");
  const[subPage,setSubPage]      = useState(null);
  const[attendSt,setAttendSt]    = useState(null);
  const[selStudent,setSelStudent]= useState(null);
  const[editStudent,setEditStudent]= useState(null);
  const[uploadOpen,setUploadOpen]= useState(false);
  const[parentUploadOpen,setParentUploadOpen]=useState(false);
  const[parentConnectOpen,setParentConnectOpen]=useState(false);
  const[feedbackSt,setFeedbackSt]= useState(null);
  const[feedbackMode,setFeedbackMode]=useState("ai");
  const[feedbackInitialArtId,setFeedbackInitialArtId]=useState(null);
  const[editArtwork,setEditArtwork]=useState(null);

  const app = useArtlogAppState({ appRole: APP_ROLE, mergeHolidaySchedules });
  const {
    auth, academy, academyOptions, students, artworks, feedbacks, notices, schedules,
    invites, linkedParents, disconnectedParents, attendMap, attendanceRecords, parentChild, parentChildren, parentStudentId, setParentStudentId, parentLinks, dataLoading, parentLinksLoading, network,
    updateAcademy, updateOptions, updateStudent, addStudent, deleteStudent,
    handleUploadSave, handleUpdateArtwork, handleAttendSave, handleVerifyParentInvite, handleConnectParentInvite, handleWithdraw, handleWithdrawParent,
    createInvite, feedbackMut, noticeMut, scheduleMut, linkedMut,
    isAdmin, isParent, academyId,
  } = app;
  const { online, queueLen, syncCount, goOffline, goOnline } = network;

  const userEmail = auth.user?.email;
  const { plan, planInfo, isMaster, canDo } = usePlan(userEmail, academy);

  // 앱 시작 시 native push token → Supabase 저장
  useEffect(() => {
    const userId = auth.user?.id;
    if (!userId) return;
    const token = window.__nativePushToken;
    if (token) savePushToken(userId, token);
  }, [auth.user?.id]);

  const academySafe = academy ?? { ...ACADEMY_DEFAULTS, notifs: { ...ACADEMY_DEFAULTS.notifs } };
  const academyOptionsSafe = academyOptions ?? loadAcademyOptions();
  const logoSrc = resolveLogoUrl(academySafe.logoUrl);
  const classTimesForAttendance=useMemo(()=>{
    const todayStr=new Date().toISOString().slice(0,10);
    const makeupToday=makeupTimesForDate(schedules.filter(s=>!s.autoHoliday),todayStr);
    return [...new Set([...academyOptionsSafe.classTimes,...students.map(s=>s.classTime).filter(Boolean),...makeupToday])].sort();
  },[academyOptionsSafe.classTimes,students,schedules]);

  const parentNotices=useMemo(
    ()=>parentChild?filterNoticesForParent(notices, parentChild.id):[],
    [notices, parentChild?.id]
  );

  const linkedStudentIds=useMemo(
    ()=>new Set(linkedParents.map(p=>String(p.studentId))),
    [linkedParents]
  );


  useEffect(() => {
    if (!auth.authReady) return;
    if (!auth.session) {
      setMode(initialAppMode());
      return;
    }
    if (IS_PARENT_APP) {
      setMode("parent");
      return;
    }
    if (IS_ADMIN_APP) {
      setMode("admin");
      return;
    }
    if (auth.profile?.role === "admin") setMode("admin");
    else if (auth.profile?.role === "parent") setMode("parent");
  }, [auth.authReady, auth.session, auth.profile?.role]);

  const roleMismatchHandledRef = useRef(false);
  useEffect(() => {
    if (!IS_SPLIT_APP || !auth.authReady || !auth.session || auth.profileLoading) return;
    const role = auth.profile?.role;
    if (!role) return;
    const mismatch =
      (IS_ADMIN_APP && role !== "admin") ||
      (IS_PARENT_APP && role !== "parent");
    if (!mismatch) {
      roleMismatchHandledRef.current = false;
      return;
    }
    if (roleMismatchHandledRef.current) return;
    roleMismatchHandledRef.current = true;
    const msg = IS_ADMIN_APP
      ? "원장 전용 앱입니다. 학부모 앱에서 로그인해 주세요."
      : "학부모 전용 앱입니다. 원장 앱에서 로그인해 주세요.";
    auth.signOut().finally(() => {
      setMode(initialAppMode());
      showAlert(msg);
    });
  }, [auth.authReady, auth.session, auth.profileLoading, auth.profile?.role, auth]);

  const [isNativeApp, setIsNativeApp] = useState(() => !!window.ArtlogNative?.isNative);
  useEffect(() => {
    if (window.ArtlogNative?.isNative) setIsNativeApp(true);
    const onReady = () => setIsNativeApp(!!window.ArtlogNative?.isNative);
    document.addEventListener("artlog-native-ready", onReady);
    return () => document.removeEventListener("artlog-native-ready", onReady);
  }, []);

  // 학부모 앱 — 네이티브 레이어 출결 백그라운드 감시 설정/해제
  useEffect(() => {
    if (!isNativeApp || !isParent) return;
    if (parentChild && academyId) {
      // auth token을 함께 전달해야 백그라운드 폴링 시 RLS를 통과할 수 있음
      const token = auth.session?.access_token ?? null;
      window.ArtlogNative?.setupAttendanceWatch?.({
        academyId,
        studentId: parentChild.id,
        studentName: parentChild.name,
        authToken: token,
      })?.catch(() => {});
    } else {
      window.ArtlogNative?.clearAttendanceWatch?.()?.catch(() => {});
    }
    return () => {
      if (isNativeApp) window.ArtlogNative?.clearAttendanceWatch?.()?.catch(() => {});
    };
  }, [isNativeApp, isParent, parentChild?.id, academyId, auth.session?.access_token]);

  const handleExitApp = useCallback(() => {
    if (!window.confirm("앱을 종료하시겠습니까?")) return;
    window.ArtlogNative?.exitApp?.();
  }, []);

  const handleUpdateAcademyOptions=useCallback(async (patch)=>{
    try{
      await updateOptions.mutateAsync({ ...academyOptionsSafe, ...patch });
    }catch(e){
      alertMutationError(e);
      throw e;
    }
  },[updateOptions, academyOptionsSafe]);

  const handleSendUnpaidReminder=useCallback(async(student)=>{
    if(!student||isPaidForMonth(student,getCalendarMonthKey()))return false;
    if(!isWithinFeeNoticeHours()){
      showAlert(`미납 알림은 ${feeNoticeWindowLabel()} 사이에 발송됩니다.`);
      return false;
    }
    const parent=linkedParents.find(p=>String(p.studentId)===String(student.id));
    if(!parent){
      showAlert(`${student.name} 학부모가 연결되지 않았습니다. 학부모 계정에서 초대해 주세요.`);
      return false;
    }
    try{
      const result=await createUnpaidFeeNotice({
        student,
        academy: academySafe,
        addNotice: (n)=>noticeMut.addNotice.mutateAsync(n),
        existingNotices: notices,
      });
      if(!result.created){
        showAlert(`이번 달 미납 공지가 이미 등록되어 있습니다. 학부모 앱 「공지」 탭에서 확인할 수 있습니다.`);
        return false;
      }
    }catch(e){
      showAlert(e?.message||"미납 공지 등록에 실패했습니다.");
      return false;
    }
    return true;
  },[linkedParents, notices, noticeMut, academySafe]);

  const adminFeeReminderTimerRef = useRef(null);

  // ── 모든 입력을 ref로 관리 ───────────────────────────────────
  // 이유: useCallback deps에 students/academySafe가 있으면
  //       리렌더마다 새 함수 참조 → useEffect 재실행 → 동시 다중 호출 → 중복 공지
  const noticesRef      = useRef(notices);
  const studentsRef     = useRef(students);
  const academySafeRef  = useRef(academySafe);
  const noticeMutRef    = useRef(noticeMut);
  const modeRef         = useRef(mode);
  useEffect(()=>{ noticesRef.current     = notices;     },[notices]);
  useEffect(()=>{ studentsRef.current    = students;    },[students]);
  useEffect(()=>{ academySafeRef.current = academySafe; },[academySafe]);
  useEffect(()=>{ noticeMutRef.current   = noticeMut;   },[noticeMut]);
  useEffect(()=>{ modeRef.current        = mode;        },[mode]);

  // 동시 실행 방지 플래그
  const feeReminderRunningRef = useRef(false);
  // 세션 내 이미 생성 요청한 공지 키 (DB 반영 전 race condition 방지)
  const sessionCreatedNoticesRef = useRef(new Set());

  // 완전히 안정적인 함수 (deps 없음) — 입력은 모두 ref에서 읽음
  const dispatchAdminFeeReminders = useCallback(() => {
    if (modeRef.current !== "admin" || !studentsRef.current.length) return;
    if (!academySafeRef.current.notifs?.paymentRemind) return;
    if (!isWithinFeeNoticeHours()) return;
    if (feeReminderRunningRef.current) return; // 이전 실행 중이면 건너뜀

    feeReminderRunningRef.current = true;

    dispatchAcademyFeeReminders({
      students: studentsRef.current,
      academy:  academySafeRef.current,
      addNotice: (n) => {
        // DB 반영 전에도 중복 방지 (title::studentId 키로 세션 내 deduplicate)
        const key = `${n.title}::${String(n.studentId ?? "")}`;
        if (sessionCreatedNoticesRef.current.has(key)) return Promise.resolve(null);
        // 기존 DB 공지와도 대조
        const alreadyInDb = noticesRef.current.some(
          (x) => x.title === n.title && String(x.studentId ?? "") === String(n.studentId ?? "")
        );
        if (alreadyInDb) return Promise.resolve(null);
        sessionCreatedNoticesRef.current.add(key);
        return noticeMutRef.current.addNotice.mutateAsync(n);
      },
      existingNotices: [], // 위에서 직접 중복 체크하므로 빈 배열 전달
    })
    .catch((e) => logBackgroundError("납부 예정 공지 자동 생성", e))
    .finally(() => { feeReminderRunningRef.current = false; });
  }, []); // deps 없음 — 완전히 안정적

  useEffect(() => {
    if (mode !== "admin") return;
    if (adminFeeReminderTimerRef.current) {
      clearTimeout(adminFeeReminderTimerRef.current);
      adminFeeReminderTimerRef.current = null;
    }
    const run = () => {
      if (isWithinFeeNoticeHours()) {
        dispatchAdminFeeReminders();
        return;
      }
      adminFeeReminderTimerRef.current = setTimeout(
        () => dispatchAdminFeeReminders(),
        msUntilNextFeeNoticeWindow()
      );
    };
    run();
    const interval = setInterval(() => {
      if (isWithinFeeNoticeHours()) dispatchAdminFeeReminders();
    }, 30 * 60 * 1000);
    return () => {
      if (adminFeeReminderTimerRef.current) clearTimeout(adminFeeReminderTimerRef.current);
      clearInterval(interval);
    };
  }, [mode, dispatchAdminFeeReminders]); // dispatchAdminFeeReminders는 절대 바뀌지 않음

  const handleLogout = useCallback(async () => {
    try {
      await auth.signOut();
      setMode(loginBackMode());
      setSelStudent(null);
      setSubPage(null);
      setParentTab("phome");
      setAdminTab("home");
    } catch (e) {
      alertMutationError(e, "로그아웃에 실패했습니다.");
    }
  }, [auth]);

  const onUploadSave = useCallback(async (payload) => {
    try {
      await handleUploadSave(payload);
      setUploadOpen(false);
      setParentUploadOpen(false);
    } catch (e) {
      showAlert(e?.message || "작품 저장에 실패했습니다.");
    }
  }, [handleUploadSave]);

  const handleArtworkFeedback = useCallback((artwork) => {
    const student = students.find((s) => String(s.id) === String(artwork.studentId));
    if (!student) return;
    setFeedbackSt(student);
    setFeedbackInitialArtId(artwork.id);
    setFeedbackMode("ai");
  }, [students]);

  const handleEditArtworkPhoto = useCallback(async (photoUri) => {
    if (!editArtwork) return;
    try {
      await handleUpdateArtwork(editArtwork.id, editArtwork.studentId, { photoUri });
      setEditArtwork(null);
    } catch (e) {
      alertMutationError(e, "작품 사진 저장에 실패했습니다.");
    }
  }, [editArtwork, handleUpdateArtwork]);

  const closeFeedbackModal = useCallback(() => {
    setFeedbackSt(null);
    setFeedbackInitialArtId(null);
  }, []);

  const handleUnlinkParent = useCallback(async (parent) => {
    try {
      const ids = parent.linkIds?.length ? parent.linkIds : [parent.id];
      for (const linkId of ids) {
        await linkedMut.unlinkParent.mutateAsync(linkId);
      }
      if (selStudent?.id === parent.studentId) setSelStudent(null);
    } catch (e) {
      alertMutationError(e, "학부모 연결 해제에 실패했습니다.");
    }
  }, [linkedMut, selStudent]);

  const handleAdminNav = useCallback((page, opts)=>{
    if(page==="payments_tab"||page==="payments"){ setSubPage("payments"); if(!opts?.keepTab) setAdminTab("more"); return; }
    if(page==="settings"){ setSubPage("settings"); if(!opts?.keepTab) setAdminTab("more"); return; }
    if(page==="upgrade"){ setSubPage("upgrade"); if(!opts?.keepTab) setAdminTab("more"); return; }
    setSubPage(page);
    if(!opts?.keepTab) setAdminTab("more");
  },[]);

  const handleSaveAcademy = useCallback(async (patch) => {
    try {
      await updateAcademy.mutateAsync({ ...academySafe, ...patch });
    } catch (e) {
      alertMutationError(e);
      throw e;
    }
  }, [updateAcademy, academySafe]);

  const handleExportData = useCallback(async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      academy: academySafe,
      students,
      artworks,
      notices,
      schedules,
      feedbacks,
      invites,
    };
    const filename = `artmuse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return exportJsonBackup(filename, data);
  }, [academySafe, students, artworks, notices, schedules, feedbacks, invites]);

  const onWithdraw = useCallback(async () => {
    if (!window.confirm("모든 학원 데이터가 삭제되며 복구할 수 없습니다. 탈퇴하시겠습니까?")) return;
    try {
      await handleWithdraw();
      setMode(initialAppMode());
      setSubPage(null);
      setSelStudent(null);
      setAdminTab("home");
      showAlert("회원 탈퇴가 완료되었습니다.");
    } catch (e) {
      alertMutationError(e, "탈퇴 처리에 실패했습니다.");
    }
  }, [handleWithdraw]);

  const handleSaveParentProfile = useCallback(async ({ fullName, phone }) => {
    try {
      await auth.updateProfile.mutateAsync({ fullName, phone });
    } catch (e) {
      alertMutationError(e, "프로필 저장에 실패했습니다.");
      throw e;
    }
  }, [auth]);

  const handleToggleParentPush = useCallback(async (enabled) => {
    try {
      for (const link of parentLinks) {
        await auth.updateParentPush.mutateAsync({ linkId: link.id, enabled });
      }
    } catch (e) {
      alertMutationError(e, "알림 설정 저장에 실패했습니다.");
      throw e;
    }
  }, [auth, parentLinks]);

  const onParentWithdraw = useCallback(async () => {
    try {
      await handleWithdrawParent();
      setMode(initialAppMode());
      setSubPage(null);
      setParentTab("phome");
      showAlert("회원 탈퇴가 완료되었습니다.");
    } catch (e) {
      alertMutationError(e, "탈퇴 처리에 실패했습니다.");
    }
  }, [handleWithdrawParent]);

  const parentPushEnabled = parentLinks.some(l => l.push_enabled !== false);

  const settingsPageProps = {
    academy: academySafe,
    onSaveAcademy: handleSaveAcademy,
    onNavigate: handleAdminNav,
    onLogout: handleLogout,
    onWithdraw: onWithdraw,
    onExportData: handleExportData,
    studentCount: students.length,
    plan,
    isMaster,
  };

  const markFeedbacksRead = useCallback((ids) => {
    if (!ids?.length) return;
    feedbackMut.markRead.mutate(ids, {
      onError: (e) => logBackgroundError("피드백 읽음 처리", e),
    });
  }, [feedbackMut]);

  const feedbackNotifyTimersRef = useRef(new Map());
  const feedbackNotifyFiredRef = useRef(new Set());

  useEffect(() => {
    const isAdminView = mode === "admin" || IS_ADMIN_APP;
    if (!isAdminView) return;

    const activeIds = new Set();
    feedbacks.forEach((f) => {
      if (!f.notifyScheduledAt || f.notifySent) return;
      activeIds.add(f.id);
      const dueAt = new Date(f.notifyScheduledAt).getTime();
      if (Number.isNaN(dueAt)) return;

      const fire = () => {
        if (feedbackNotifyFiredRef.current.has(f.id)) return;
        // 원장 기기에는 알림 미발송 — 학부모 앱의 useFeedbackNotifyWatch에서 처리
        feedbackMut.markNotifySent.mutate(f.id, {
          onSuccess: () => {
            feedbackNotifyFiredRef.current.add(f.id);
            feedbackNotifyTimersRef.current.delete(f.id);
          },
          onError: (e) => logBackgroundError("피드백 예약 알림 완료 처리", e),
        });
      };

      if (dueAt <= Date.now()) {
        fire();
        return;
      }
      if (feedbackNotifyTimersRef.current.has(f.id)) return;
      const timer = setTimeout(fire, Math.min(dueAt - Date.now(), 2147483647));
      feedbackNotifyTimersRef.current.set(f.id, timer);
    });

    feedbackNotifyTimersRef.current.forEach((timer, id) => {
      if (!activeIds.has(id)) {
        clearTimeout(timer);
        feedbackNotifyTimersRef.current.delete(id);
      }
    });
  }, [feedbacks, mode, feedbackMut]);

  const [attendLocalPatch, setAttendLocalPatch] = useState({});
  const attendMapMerged = useMemo(() => ({ ...attendMap }), [attendMap]);
  const attendMapDisplay = useMemo(() => ({ ...attendMapMerged, ...attendLocalPatch }), [attendMapMerged, attendLocalPatch]);

  const onAttendSave = useCallback(async (id, status, classTime) => {
    const student = students.find(s => s.id === id);
    try {
      await handleAttendSave(id, status, classTime, student?.name);
      setAttendLocalPatch(p => ({ ...p, [attendKey(id, classTime)]: status }));
      setAttendSt(null);
    } catch (e) {
      alertMutationError(e, "출결 저장에 실패했습니다.");
    }
  }, [students, handleAttendSave]);

  const onAdminSignIn = useCallback(async ({ email, password }) => {
    await auth.signInAdmin.mutateAsync({ email, password });
  }, [auth]);

  const onAdminSignUp = useCallback(async ({ email, password }) => {
    await auth.signUpAdmin.mutateAsync({ email, password, fullName: email.split("@")[0] });
    const sb = requireSupabase();
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) {
      throw new Error("이메일 확인 후 다시 로그인해 주세요.");
    }
  }, [auth]);

  const onUpdateFeedback = useCallback(async (id, patch) => {
    try {
      await feedbackMut.updateFeedback.mutateAsync({ id, patch });
    } catch (e) {
      alertMutationError(e, "피드백 수정에 실패했습니다.");
      throw e;
    }
  }, [feedbackMut]);

  const onDeleteFeedback = useCallback(async (id) => {
    try {
      await feedbackMut.deleteFeedback.mutateAsync(id);
    } catch (e) {
      alertMutationError(e, "피드백 삭제에 실패했습니다.");
    }
  }, [feedbackMut]);

  const onAddFeedback = useCallback(async (f) => {
    try {
      await feedbackMut.addFeedback.mutateAsync(f);
    } catch (e) {
      alertMutationError(e, "피드백 저장에 실패했습니다.");
      throw e;
    }
  }, [feedbackMut]);

  const onAddSchedule = useCallback(async (s) => {
    try {
      const created = await scheduleMut.addSchedule.mutateAsync(s);
      if (s.type === "makeup" && (s.studentIds?.length ?? 0) > 0) {
        try {
          await publishMakeupNotices({
            schedule: { ...s, id: created?.id },
            students,
            academyName: academySafe?.name,
            addNotice: (n) => noticeMut.addNotice.mutateAsync(n),
            existingNotices: notices,
          });
        } catch (noticeErr) {
          showAlert(`${dbErrorMessage(noticeErr)}\n\n일정은 저장되었으나 보강 공지 발송에 실패했습니다. 공지를 직접 등록해 주세요.`);
        }
      }
      return created;
    } catch (e) {
      showAlert(dbErrorMessage(e));
      throw e;
    }
  }, [scheduleMut, noticeMut, students, academySafe?.name, notices]);

  const onUpdateSchedule = useCallback(async (id, patch) => {
    try {
      const updated = await scheduleMut.updateSchedule.mutateAsync({ id, patch });
      if (patch.type === "makeup" && (patch.studentIds?.length ?? 0) > 0) {
        try {
          await publishMakeupNotices({
            schedule: { ...patch, id, date: patch.date },
            students,
            academyName: academySafe?.name,
            addNotice: (n) => noticeMut.addNotice.mutateAsync(n),
            existingNotices: notices,
          });
        } catch (noticeErr) {
          showAlert(`${dbErrorMessage(noticeErr)}\n\n일정은 저장되었으나 보강 공지 발송에 실패했습니다. 공지를 직접 등록해 주세요.`);
        }
      }
      return updated;
    } catch (e) {
      showAlert(dbErrorMessage(e));
      throw e;
    }
  }, [scheduleMut, noticeMut, students, academySafe?.name, notices]);

  const onDeleteSchedule = useCallback(async (id) => {
    try {
      await scheduleMut.deleteSchedule.mutateAsync(id);
    } catch (e) {
      showAlert(dbErrorMessage(e));
      throw e;
    }
  }, [scheduleMut]);

  const onAddNotice = useCallback(async (n) => {
    try {
      await noticeMut.addNotice.mutateAsync(n);
    } catch (e) {
      alertMutationError(e, "공지 등록에 실패했습니다.");
      throw e;
    }
  }, [noticeMut]);

  const onUpdateNotice = useCallback(async (id, patch) => {
    try {
      await noticeMut.updateNotice.mutateAsync({ id, patch });
    } catch (e) {
      alertMutationError(e, "공지 수정에 실패했습니다.");
      throw e;
    }
  }, [noticeMut]);

  const onDeleteNotice = useCallback(async (id) => {
    try {
      await noticeMut.deleteNotice.mutateAsync(id);
    } catch (e) {
      alertMutationError(e, "공지 삭제에 실패했습니다.");
    }
  }, [noticeMut]);

  const onAddStudent = useCallback(async (s) => {
    if (plan === "free" && !isMaster && students.length >= PLANS.free.maxStudents) {
      showAlert(`Free 플랜은 학생 최대 ${PLANS.free.maxStudents}명까지 등록할 수 있습니다.\n더 보기 → 플랜 업그레이드를 이용해 주세요.`);
      throw new Error("plan_limit");
    }
    try {
      await addStudent(s);
    } catch (e) {
      if (e.message !== "plan_limit") alertMutationError(e, "학생 등록에 실패했습니다.");
      throw e;
    }
  }, [addStudent, plan, isMaster, students.length]);

  const onUpdateStudent = useCallback(async (id, patch) => {
    try {
      await updateStudent(id, patch);
      setSelStudent(prev => prev?.id === id ? { ...prev, ...patch } : prev);
    } catch (e) {
      alertMutationError(e);
      throw e;
    }
  }, [updateStudent]);

  const onDeleteStudent = useCallback(async (id) => {
    try {
      await deleteStudent(id);
      setSelStudent(prev => (prev?.id === id ? null : prev));
    } catch (e) {
      alertMutationError(e, "학생 삭제에 실패했습니다.");
      throw e;
    }
  }, [deleteStudent]);

  if (!auth.authReady && IS_SPLIT_APP) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.cream }}>
        <div style={{ textAlign: "center", color: C.warm }}>로그인 확인 중…</div>
      </div>
    );
  }

  if (auth.authReady && auth.session && dataLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.cream }}>
        <div style={{ textAlign: "center", color: C.warm }}>데이터 불러오는 중…</div>
      </div>
    );
  }

  const adminNeedsAcademy = IS_ADMIN_APP && mode === "admin" && auth.session && !auth.profileLoading && !auth.profile?.academyId;

  const renderAdmin=()=>{
    if(selStudent) return (
      <StudentDetail
        student={selStudent}
        feedbacks={feedbacks}
        artworks={artworks}
        academy={academySafe}
        attendanceRecords={attendanceRecords}
        onBack={()=>setSelStudent(null)}
        onFeedback={st=>{setSelStudent(null);setFeedbackSt(st);setFeedbackMode("ai");}}
        onManualFeedback={st=>{setSelStudent(null);setFeedbackSt(st);setFeedbackMode("manual");}}
        onEdit={()=>setEditStudent(selStudent)}
        onUpdateFeedback={onUpdateFeedback}
        onDeleteFeedback={onDeleteFeedback}
        plan={plan}
        isMaster={isMaster}
        onUpgrade={()=>handleAdminNav("upgrade")}
        academyId={academyId}
        adminId={auth.user?.id}
      />
    );
    if(subPage==="schedule") return (
      <AdminSchedule
        schedules={schedules}
        students={students}
        onAddSchedule={onAddSchedule}
        onUpdateSchedule={onUpdateSchedule}
        onDeleteSchedule={onDeleteSchedule}
        onBack={()=>setSubPage(null)}
      />
    );
    if(subPage==="payments") return (
      <AdminPayments
        students={students}
        onUpdateStudent={onUpdateStudent}
        linkedParents={linkedParents}
        onSendUnpaidReminder={handleSendUnpaidReminder}
        onBack={()=>setSubPage(null)}
      />
    );
    if(subPage==="stats")           return <AdminStats     onBack={()=>setSubPage(null)} students={students} artworks={artworks} attendanceRecords={attendanceRecords} academy={academySafe}/>;
    if(subPage==="notice") return (
      <NoticeManager
        notices={notices}
        onAddNotice={onAddNotice}
        onUpdateNotice={onUpdateNotice}
        onDeleteNotice={onDeleteNotice}
        onBack={()=>setSubPage(null)}
      />
    );
    if(subPage==="beforeafter")     return <BeforeAfterPage onBack={()=>setSubPage(null)} students={students} artworks={artworks}/>;
    if(subPage==="upgrade")           return <UpgradePage onBack={()=>setSubPage(null)} plan={plan} isMaster={isMaster}/>;
    if(subPage==="settings_notif")   return <SettingsPage onBack={()=>setSubPage(null)} initTab="notif" {...settingsPageProps}/>;
    if(subPage==="settings_account") return <SettingsPage onBack={()=>setSubPage(null)} initTab="account" {...settingsPageProps}/>;
    if(subPage==="settings")         return <SettingsPage onBack={()=>setSubPage(null)} {...settingsPageProps}/>;
    if(subPage==="parent_accounts")  return (
      <ParentAccountManager
        students={students}
        linkedParents={linkedParents}
        disconnectedParents={disconnectedParents}
        invites={invites}
        onCreateInvite={createInvite}
        onUnlinkParent={handleUnlinkParent}
        onBack={()=>setSubPage(null)}
        academyName={academySafe.name}
      />
    );
    if(subPage==="feedback_history") return (
      <AdminFeedbackHistory
        feedbacks={feedbacks}
        onBack={()=>setSubPage(null)}
        onUpdateFeedback={onUpdateFeedback}
        onDeleteFeedback={onDeleteFeedback}
      />
    );
    if(subPage==="offline_queue")    return <OfflineQueuePage    onBack={()=>setSubPage(null)} online={online} queueLen={queueLen} onGoOnline={goOnline}/>;
    switch(adminTab){
      case"home":     return <AdminHome students={students} schedules={schedules} notices={notices} feedbacks={feedbacks} onAttendTap={setAttendSt} onNavigate={handleAdminNav} attendanceMap={attendMapDisplay} logoSrc={logoSrc} classTimes={classTimesForAttendance} isNativeApp={isNativeApp} onExitApp={handleExitApp} plan={plan} isMaster={isMaster}/>;
      case"students": return <AdminStudents students={students} onSelect={setSelStudent} onUpdateStudent={onUpdateStudent} onAddStudent={onAddStudent} onDeleteStudent={onDeleteStudent} linkedStudentIds={linkedStudentIds} academyOptions={academyOptionsSafe} onUpdateAcademyOptions={handleUpdateAcademyOptions} attendanceRecords={attendanceRecords} academy={academySafe}/>;
      case"artworks": return <AdminArtworks students={students} artworks={artworks} onUpload={()=>setUploadOpen(true)} onBeforeAfter={()=>setSubPage("beforeafter")} onArtworkFeedback={handleArtworkFeedback} onEditArtwork={setEditArtwork}/>;
      case"schedule": return (
        <AdminSchedule
          schedules={schedules}
          students={students}
          onAddSchedule={onAddSchedule}
          onUpdateSchedule={onUpdateSchedule}
          onDeleteSchedule={onDeleteSchedule}
        />
      );
      case"chat":     return <AdminDMPage students={students} academyId={academyId} adminId={auth.user?.id}/>;
      case"more":     return <AdminMore students={students} onNavigate={handleAdminNav} academy={academySafe} logoSrc={logoSrc}/>;
      default:        return <AdminHome students={students} schedules={schedules} notices={notices} feedbacks={feedbacks} onAttendTap={setAttendSt} onNavigate={handleAdminNav} attendanceMap={attendMapDisplay} logoSrc={logoSrc} classTimes={classTimesForAttendance} isNativeApp={isNativeApp} onExitApp={handleExitApp}/>;
    }
  };

  const renderParent=()=>{
    if (parentTab === "psettings") {
      return (
        <ParentSettingsPage
          profile={auth.profile}
          userEmail={auth.user?.email}
          pushEnabled={parentPushEnabled}
          onTogglePush={handleToggleParentPush}
          onSaveProfile={handleSaveParentProfile}
          onLogout={handleLogout}
          onWithdraw={onParentWithdraw}
          linkedChildren={parentChildren}
          onAddChild={() => setParentConnectOpen(true)}
        />
      );
    }
    if (!parentChild) {
      if (parentLinksLoading) {
        return (
          <div style={{ padding: "80px 24px", textAlign: "center", color: C.warm }}>
            연결 정보 불러오는 중…
          </div>
        );
      }
      return (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>👨‍👩‍👧</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.charcoal, marginBottom: 8 }}>자녀 연결이 필요합니다</div>
          <div style={{ fontSize: 13, color: C.warm, lineHeight: 1.7, marginBottom: 20 }}>
            학원에서 받은 초대 코드를 입력해<br/>자녀 정보를 연결해 주세요.
          </div>
          <button
            onClick={() => setParentConnectOpen(true)}
            style={{ padding: "12px 24px", borderRadius: 12, background: C.terra, color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            초대 코드로 연결하기
          </button>
        </div>
      );
    }
    const parentHeader = (
      <ParentAppHeader
        logoSrc={logoSrc}
        linkedChildren={parentChildren}
        activeChildId={parentStudentId ?? parentChild.id}
        onSelectChild={setParentStudentId}
        onNoticeTap={() => setParentTab("pnotice")}
        noticeCount={parentNotices.filter((n) => n.important).length || parentNotices.length}
        onAddChild={() => setParentConnectOpen(true)}
        isNativeApp={isNativeApp}
        onExitApp={handleExitApp}
      />
    );

    if(subPage==="pnotice") return (
      <>
        {parentHeader}
        <NoticeManager isParent notices={parentNotices} onBack={()=>setSubPage(null)} onAddNotice={()=>{}} onUpdateNotice={()=>{}} onDeleteNotice={()=>{}}/>
      </>
    );
    switch(parentTab){
      case"phome":     return <>{parentHeader}<ParentHome key={parentChild.id} student={parentChild} feedbacks={feedbacks} artworks={artworks} notices={parentNotices} attendanceRecords={attendanceRecords} schedules={schedules} onTab={setParentTab}/></>;
      case"partworks": return <>{parentHeader}<ParentArtworks key={parentChild.id} student={parentChild} artworks={artworks} academy={academySafe} feedbacks={feedbacks} onUpload={()=>setParentUploadOpen(true)}/></>;
      case"pfeedback": return <>{parentHeader}<ParentFeedback key={parentChild.id} student={parentChild} feedbacks={feedbacks} onMarkRead={markFeedbacksRead} userId={auth.user?.id} academyId={academyId}/></>;
      case"pschedule": return <>{parentHeader}<ParentScheduleCalendar key={parentChild.id} student={parentChild} schedules={schedules}/></>;
      case"pnotice":   return <>{parentHeader}<NoticeManager isParent notices={parentNotices} onBack={()=>setParentTab("phome")} onAddNotice={()=>{}} onUpdateNotice={()=>{}} onDeleteNotice={()=>{}}/></>;
      case"pchat":     return <>{parentHeader}<ParentChatPage key={parentChild.id} student={parentChild} academyId={academyId} userId={auth.user?.id}/></>;
      default:         return <>{parentHeader}<ParentHome key={parentChild.id} student={parentChild} feedbacks={feedbacks} artworks={artworks} notices={parentNotices} attendanceRecords={attendanceRecords} schedules={schedules} onTab={setParentTab}/></>;
    }
  };

  const showAdminTabs = mode==="admin"&&!selStudent&&!subPage;
  const showParentTabs= mode==="parent"&&!subPage&&auth.session;
  const visibleParentTabs = parentChild
    ? PARENT_TABS
    : PARENT_TABS.filter(t => t.id === "phome" || t.id === "psettings");

  return(
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif}
        @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{display:none}
      `}</style>

      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#C17F5B 0%,#9B5F3F 45%,#7A9E7E 100%)",padding:"20px 6px 40px"}}>
        <div style={{width:"100%",maxWidth:430,background:C.cream,minHeight:"90vh",maxHeight:"92vh",borderRadius:20,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,0,0,0.4)",position:"relative",display:"flex",flexDirection:"column"}}>

          {/* Offline banner */}
          <OfflineBanner online={online} queueLen={queueLen} syncCount={syncCount} onToggle={goOnline}/>

          {adminNeedsAcademy && (
            <div style={{background:"#FFF3E0",color:"#9B5F3F",padding:"10px 16px",fontSize:12,lineHeight:1.5,textAlign:"center",borderBottom:`1px solid ${C.light}`}}>
              학원 설정을 불러오는 중입니다. 잠시 후에도 학생 등록이 안 되면 로그아웃 후 다시 로그인해 주세요.
            </div>
          )}

          {(mode==="admin"||mode==="parent")&&!IS_SPLIT_APP&&(
            <div style={{position:"absolute",top:10,left:10,right:10,zIndex:150,display:"flex",gap:6,flexWrap:"wrap",justifyContent:"space-between",alignItems:"flex-start",pointerEvents:"none"}}>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",pointerEvents:"auto"}}>
                <button onClick={()=>{setMode(null);setSelStudent(null);setSubPage(null);}} style={{padding:"4px 10px",borderRadius:20,background:"rgba(255,255,255,0.85)",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",color:C.terra}}>← 전환</button>
                {mode==="admin" &&<button onClick={()=>{setMode("parent");setSubPage(null);}} style={{padding:"4px 10px",borderRadius:20,background:C.sage,border:"none",fontSize:10,fontWeight:700,cursor:"pointer",color:"white"}}>학부모 뷰</button>}
                {mode==="parent"&&<button onClick={()=>{setMode("admin"); setSubPage(null);}} style={{padding:"4px 10px",borderRadius:20,background:C.terra,border:"none",fontSize:10,fontWeight:700,cursor:"pointer",color:"white"}}>원장 뷰</button>}
              </div>
              {isNativeApp&&(
                <button onClick={handleExitApp} style={{padding:"4px 10px",borderRadius:20,background:"rgba(255,255,255,0.85)",border:"none",fontSize:10,fontWeight:700,cursor:"pointer",color:C.warm,pointerEvents:"auto",flexShrink:0}}>앱 종료</button>
              )}
            </div>
          )}
          {/* IS_SPLIT_APP 종료버튼은 AdminHome/ParentAppHeader 날짜 옆으로 이동 */}

          <div style={{flex:1,overflowY:"auto",paddingBottom:(mode==="admin"||mode==="parent")?66:0,paddingTop:(mode==="admin"||mode==="parent")&&!IS_SPLIT_APP&&isNativeApp?36:0}}>
            {!IS_SPLIT_APP&&!mode&&<ModeSelect onSelectRole={r=>setMode(`login_${r}`)} logoSrc={logoSrc} tagline={academy.tagline} isNativeApp={isNativeApp} onExitApp={handleExitApp}/>}
            {mode==="login_admin"  &&<LoginScreen role="admin" onLogin={r=>{setMode(r);}} onBack={IS_SPLIT_APP?undefined:()=>setMode(null)} onAdminSignIn={onAdminSignIn} onAdminSignUp={onAdminSignUp} logoSrc={logoSrc} isNativeApp={isNativeApp} onExitApp={handleExitApp}/>}
            {mode==="login_parent" &&<LoginScreen role="parent" onLogin={r=>{setMode(r);}} onBack={IS_SPLIT_APP?undefined:()=>setMode(null)} onVerifyInvite={handleVerifyParentInvite} logoSrc={logoSrc} isNativeApp={isNativeApp} onExitApp={handleExitApp}/>}
            {mode==="admin"  &&renderAdmin()}
            {mode==="parent" &&renderParent()}
          </div>

          {showAdminTabs&&(
            <div style={{position:"absolute",bottom:0,left:0,right:0,background:C.white,borderTop:`1px solid ${C.beige}`,display:"flex",zIndex:100}}>
              {ADMIN_TABS.map(tab=>(
                <button key={tab.id} onClick={()=>{setAdminTab(tab.id);setSubPage(null);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 0 12px",background:"none",border:"none",cursor:"pointer",gap:3,color:adminTab===tab.id?C.terra:C.warm,position:"relative"}}>
                  {adminTab===tab.id&&<div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:28,height:2,borderRadius:2,background:C.terra}}/>}
                  <span style={{fontSize:18,lineHeight:1}}>{tab.icon}</span>
                  <span style={{fontSize:9,fontWeight:adminTab===tab.id?700:400}}>{tab.label}</span>
                </button>
              ))}
            </div>
          )}

          {showParentTabs&&(
            <div style={{position:"absolute",bottom:0,left:0,right:0,background:C.white,borderTop:`1px solid ${C.beige}`,display:"flex",zIndex:100}}>
              {visibleParentTabs.map(tab=>(
                <button key={tab.id} onClick={()=>setParentTab(tab.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 0 12px",background:"none",border:"none",cursor:"pointer",gap:3,color:parentTab===tab.id?C.terra:C.warm,position:"relative"}}>
                  {parentTab===tab.id&&<div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:28,height:2,borderRadius:2,background:C.terra}}/>}
                  <span style={{fontSize:18,lineHeight:1}}>{tab.icon}</span>
                  <span style={{fontSize:9,fontWeight:parentTab===tab.id?700:400}}>{tab.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {attendSt  &&<OfflineAttendModal student={attendSt} online={online} onClose={()=>setAttendSt(null)} onSave={onAttendSave}/>}
      {uploadOpen &&<UploadModal onClose={()=>setUploadOpen(false)} onSave={onUploadSave} students={students}/>}
      {parentUploadOpen &&<UploadModal presetStudent={parentChild} parentMode onClose={()=>setParentUploadOpen(false)} onSave={onUploadSave} students={students}/>}
      {feedbackSt&&<FeedbackModal student={feedbackSt} artworks={artworks} mode={feedbackMode} initialArtId={feedbackInitialArtId} onClose={closeFeedbackModal} onSend={onAddFeedback}/>}
      {editArtwork&&<ArtworkPhotoEditModal artwork={editArtwork} onClose={()=>setEditArtwork(null)} onSave={handleEditArtworkPhoto}/>}
      {editStudent&&<StudentRegisterModal initial={editStudent} onClose={()=>setEditStudent(null)} onSave={async updated=>{try{await onUpdateStudent(editStudent.id,updated);setEditStudent(null);}catch{/* alert in handler */}}} academyOptions={academyOptionsSafe} onUpdateAcademyOptions={handleUpdateAcademyOptions}/>}
      {parentConnectOpen&&<ParentConnectSheet onClose={()=>setParentConnectOpen(false)} onConnect={handleConnectParentInvite}/>}
      <AppAlertModal message={alertMsg} onClose={()=>setAlertMsg(null)}/>
    </>
  );
}
