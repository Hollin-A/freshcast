import { Module } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { currentBusinessId, type RequestContext } from "./business-context.js";
import { PrismaService } from "./prisma.service.js";
import { createScopedClient, SCOPED_PRISMA } from "./scoped-prisma.js";

/**
 * Two clients over one connection pool. Services inject the scoped client
 * with @InjectScopedPrisma(); it adds the request's Business to every query
 * (ADR-025). PrismaService is unscoped; only the places listed in
 * docs/ARCHITECTURE.md use it.
 */
@Module({
  providers: [
    PrismaService,
    {
      provide: SCOPED_PRISMA,
      inject: [PrismaService, ClsService],
      useFactory: (prisma: PrismaService, cls: ClsService<RequestContext>) =>
        createScopedClient(prisma, () => currentBusinessId(cls)),
    },
  ],
  exports: [PrismaService, SCOPED_PRISMA],
})
export class DatabaseModule {}
