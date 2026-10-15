import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { AUDIT_ACTION, USER_ROLE, type Expense, type ExpensesPage } from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { EXPENSES_ENTITY } from "@api/common/constants/audit-entities";
import { ExpensesService } from "@api/modules/expenses/services/expenses.service";
import {
  CreateExpenseDto,
  ExpenseQueryDto,
  IdParamDto,
  ReverseExpenseDto,
} from "@api/modules/expenses/dto/expenses.dto";

@Controller("expenses")
@Roles(USER_ROLE.ADMIN)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ExpenseQueryDto,
  ): Promise<ExpensesPage> {
    return this.expenses.list(actor, query);
  }

  @Post()
  @Audit(EXPENSES_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateExpenseDto,
  ): Promise<Expense> {
    return this.expenses.create(actor, body);
  }

  @Post(":id/reverse")
  @Audit(EXPENSES_ENTITY, AUDIT_ACTION.CREATE, { entityIdSource: "response" })
  reverse(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: ReverseExpenseDto,
  ): Promise<Expense> {
    return this.expenses.reverse(actor, params.id, body.reason);
  }
}
