import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import {
  AUDIT_ACTION,
  USER_ROLE,
  type Payroll,
  type PayrollAdjustment,
  type SalaryTerm,
  type StaffPayment,
} from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import {
  PAYROLL_ADJUSTMENTS_ENTITY,
  PAYROLL_MONTHS_ENTITY,
  SALARY_TERMS_ENTITY,
  STAFF_PAYMENTS_ENTITY,
} from "@api/common/constants/audit-entities";
import { PayrollService } from "@api/modules/payroll/services/payroll.service";
import { StaffPaymentsService } from "@api/modules/payroll/services/staff-payments.service";
import {
  CreatePayrollAdjustmentDto,
  CreateSalaryPaymentDto,
  IdParamDto,
  MonthParamDto,
  ReverseEntryDto,
  SalaryTermsDto,
} from "@api/modules/payroll/dto/payroll.dto";

@Controller("payroll")
@Roles(USER_ROLE.ADMIN)
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get("salaries/:id")
  salaries(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<SalaryTerm[]> {
    return this.payroll.salaryHistory(actor, params.id);
  }

  @Put("salaries/:id")
  @Audit(SALARY_TERMS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  setSalary(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: SalaryTermsDto,
  ): Promise<SalaryTerm> {
    return this.payroll.setSalary(actor, params.id, body);
  }

  @Get(":month")
  month(@CurrentUser() actor: AuthenticatedUser, @Param() params: MonthParamDto): Promise<Payroll> {
    return this.payroll.payroll(actor, params.month);
  }

  @Post(":month/adjustments")
  @Audit(PAYROLL_ADJUSTMENTS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  adjust(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: MonthParamDto,
    @Body() body: CreatePayrollAdjustmentDto,
  ): Promise<PayrollAdjustment> {
    return this.payroll.addAdjustment(actor, params.month, body);
  }

  @Post(":month/payments")
  @Audit(STAFF_PAYMENTS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  pay(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: MonthParamDto,
    @Body() body: CreateSalaryPaymentDto,
  ): Promise<StaffPayment> {
    return this.payroll.pay(actor, params.month, body);
  }

  @Post(":month/close")
  @Audit(PAYROLL_MONTHS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  close(@CurrentUser() actor: AuthenticatedUser, @Param() params: MonthParamDto): Promise<Payroll> {
    return this.payroll.close(actor, params.month);
  }
}

@Controller("payroll-adjustments")
@Roles(USER_ROLE.ADMIN)
export class PayrollAdjustmentsController {
  constructor(private readonly payroll: PayrollService) {}

  @Post(":id/reverse")
  @Audit(PAYROLL_ADJUSTMENTS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  reverse(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ReverseEntryDto,
  ): Promise<PayrollAdjustment> {
    return this.payroll.reverseAdjustment(actor, params.id, body.reason);
  }
}

@Controller("staff-payments")
@Roles(USER_ROLE.ADMIN)
export class StaffPaymentsController {
  constructor(private readonly payments: StaffPaymentsService) {}

  @Post(":id/reverse")
  @Audit(STAFF_PAYMENTS_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  reverse(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ReverseEntryDto,
  ): Promise<StaffPayment> {
    return this.payments.reverse(actor, params.id, body.reason);
  }
}
