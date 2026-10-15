import { Module } from "@nestjs/common";
import { ExpensesController } from "@api/modules/expenses/controllers/expenses.controller";
import { ExpensesService } from "@api/modules/expenses/services/expenses.service";

@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
