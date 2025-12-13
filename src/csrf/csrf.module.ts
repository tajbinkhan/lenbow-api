import { Global, Module } from '@nestjs/common';
import { CsrfController } from 'src/csrf/csrf.controller';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from './csrf.service';

@Global()
@Module({
	controllers: [CsrfController],
	providers: [CsrfService, CsrfGuard],
	exports: [CsrfService, CsrfGuard],
})
export class CsrfModule {}
