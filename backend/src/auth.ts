import { Body, CanActivate, Controller, ExecutionContext, Injectable, Post, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { Database } from './prisma';
import { parse, z } from './validation';
export type Identity = { sub: string; role: string; fullName: string };
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  async canActivate(context: ExecutionContext) { const req = context.switchToHttp().getRequest(); const token = req.headers.authorization?.replace(/^Bearer /, ''); if (!token) throw new UnauthorizedException('Please sign in'); try { req.user = await this.jwt.verifyAsync(token); return true; } catch { throw new UnauthorizedException('Session expired'); } }
}
@Controller('auth')
export class AuthController {
  constructor(private db: Database, private jwt: JwtService) {}
  @Post('register') async register(@Body() body: unknown) { const data = parse(z.object({ email: z.email().toLowerCase(), password: z.string().min(10).max(72), fullName:z.string().min(2).max(100), role:z.enum(['HOST','VENDOR']).default('HOST') }),body); if (await this.db.user.findUnique({where:{email:data.email}})) throw new ConflictException('Email already registered'); const user = await this.db.user.create({data:{email:data.email,fullName:data.fullName,role:data.role,passwordHash:await hash(data.password,12)}}); return this.session(user); }
  @Post('login') async login(@Body() body: unknown) { const data = parse(z.object({email:z.email().toLowerCase(),password:z.string().max(100)}),body); const user = await this.db.user.findUnique({where:{email:data.email}}); if (!user || !await compare(data.password,user.passwordHash)) throw new UnauthorizedException('Incorrect email or password'); return this.session(user); }
  private session(user: {id:string;role:string;fullName:string}) { return {token:this.jwt.sign({sub:user.id,role:user.role,fullName:user.fullName}),user:{id:user.id,role:user.role,fullName:user.fullName}}; }
}
