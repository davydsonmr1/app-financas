/**
 * Testa RLS e regras de negócio direto no Postgres, simulando dois usuários
 * (A e B) via `set local role authenticated` + `request.jwt.claims`. Tudo
 * roda dentro de UMA transação com rollback no final — nunca deixa dado de
 * teste no banco. Ver docs/ESCOPO.md para o porquê de cada regra.
 *
 *   npm run db:test
 */
require('dotenv').config();
const {Client}=require('pg');
const c=new Client({connectionString:process.env.DBURL,ssl:{rejectUnauthorized:false}});
const A='11111111-1111-1111-1111-111111111111', B='22222222-2222-2222-2222-222222222222';
let pass=0, fail=0;
const check=(label,cond,extra='')=>{ (cond?pass++:fail++); console.log((cond?'  ok   ':'  FALHA')+'  '+label+(extra?'  ['+extra+']':'')); };
const as=async u=>{ await c.query("reset role"); await c.query("set local role authenticated");
  await c.query(`set local request.jwt.claims = '{"sub":"${u}","role":"authenticated"}'`); };
const expectFail=async(label,sql,params,needle)=>{
  await c.query('savepoint sp');
  let msg='(nao lancou excecao)';
  try{ await c.query(sql,params); }catch(e){ msg=e.message; }
  await c.query('rollback to savepoint sp');
  check(label, msg.includes(needle), msg.slice(0,40));
};
const root=async()=>{ await c.query("reset role"); await c.query("select set_config('request.jwt.claims','',true)"); };

(async()=>{
 await c.connect(); await c.query('begin');
 try{
  for(const [id,mail] of [[A,'davyd@test.local'],[B,'amiga@test.local']])
    await c.query(`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,
      email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
      values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,'x',
      now(),now(),now(),'{}','{}')`,[id,mail]);

  const sp=async u=>(await c.query('select id,name,is_personal from spaces where owner_id=$1',[u])).rows;
  const spA=await sp(A), spB=await sp(B);
  check('trigger cria Espaco Pessoal para cada usuario', spA.length===1&&spB.length===1&&spA[0].is_personal);
  check('categorias copiadas no Espaco novo',
    Number((await c.query('select count(*) n from categories where space_id=$1',[spA[0].id])).rows[0].n)===24);

  console.log('\n-- ISOLAMENTO --');
  await as(A);
  check('A enxerga so o proprio Espaco',
    Number((await c.query('select count(*) n from spaces')).rows[0].n)===1);
  check('A NAO enxerga o Espaco Pessoal de B',
    Number((await c.query('select count(*) n from spaces where id=$1',[spB[0].id])).rows[0].n)===0);
  check('tabela spaces nao tem coluna password_hash',
    Number((await c.query(`select count(*) n from information_schema.columns
      where table_name='spaces' and column_name='password_hash'`)).rows[0].n)===0);
  await expectFail('space_secrets e inacessivel via API',
    'select * from space_secrets',[],'permission denied');
  check('A nao ve as categorias do Espaco de B',
    Number((await c.query('select count(*) n from categories where space_id=$1',[spB[0].id])).rows[0].n)===0);

  console.log('\n-- ESPACO COMPARTILHADO --');
  const casa=(await c.query("select create_space('Casa','home','#8b5cf6','segredo123') as id")).rows[0].id;
  await root();
  const code=(await c.query('select invite_code from spaces where id=$1',[casa])).rows[0].invite_code;

  await as(B);
  await expectFail('B com senha ERRADA e barrado',
    'select join_space($1,$2)', [code,'senhaerrada'], 'senha incorreta');
  await expectFail('convite inexistente e barrado',
    'select join_space($1,$2)', ['ZZZZZZZZ','segredo123'], 'convite invalido');
  await expectFail('B nao consegue inserir gasto em Espaco alheio',
    'insert into transactions (space_id,user_id,amount,occurred_at) values ($1,$2,10,current_date)',
    [spA[0].id,B], 'row-level security');

  await c.query('select join_space($1,$2)',[code,'segredo123']);
  check('B com senha CERTA entra',
    Number((await c.query('select count(*) n from spaces where id=$1',[casa])).rows[0].n)===1);
  check('spaces expoe apenas has_password, nao o hash',
    (await c.query('select has_password from spaces where id=$1',[casa])).rows[0].has_password===true);
  await expectFail('membro NAO le space_secrets nem sendo do Espaco',
    'select password_hash from space_secrets where space_id=$1',[casa],'permission denied');

  console.log('\n-- LANCAMENTOS --');
  await as(A);
  const cat=(await c.query("select id from categories where space_id=$1 and name='Mercado'",[casa])).rows[0].id;
  await c.query(`insert into transactions (space_id,user_id,attributed_to,category_id,amount,description,occurred_at)
    values ($1,$2,null,$3,250.00,'Compra do mes',current_date)`,[casa,A,cat]);
  await c.query(`insert into transactions (space_id,user_id,attributed_to,category_id,amount,description,occurred_at)
    values ($1,$2,$2,(select id from categories where space_id=$1 limit 1),80.00,'privado',current_date)`,[spA[0].id,A]);

  await as(B);
  check('B ve o gasto da Casa lancado por A',
    Number((await c.query('select count(*) n from transactions where space_id=$1',[casa])).rows[0].n)===1);
  check('B NAO ve o gasto do Espaco Pessoal de A',
    Number((await c.query('select count(*) n from transactions where space_id=$1',[spA[0].id])).rows[0].n)===0);

  console.log('\n-- REEMBOLSO / VALOR EFETIVO --');
  await as(A);
  const tx=(await c.query('select id from transactions where space_id=$1',[casa])).rows[0].id;
  await c.query('insert into refunds (transaction_id,amount) values ($1,100.00)',[tx]);
  const eff=(await c.query('select amount, effective_amount from v_transactions where id=$1',[tx])).rows[0];
  check('valor efetivo = 250 - 100 = 150', Number(eff.effective_amount)===150, `bruto ${eff.amount}`);

  console.log('\n-- RENDA COMPARTILHADA --');
  await root();
  await c.query(`insert into incomes (user_id,label,amount,effective_from) values
    ($1,'Salario',5000,date_trunc('month',current_date)::date)`,[A]);
  await c.query(`insert into incomes (user_id,label,amount,effective_from) values
    ($1,'Salario',3000,date_trunc('month',current_date)::date)`,[B]);

  await as(B);
  check('B (share_income=true por padrao na Casa) LE a renda de A',
    Number((await c.query('select count(*) n from incomes where user_id=$1',[A])).rows[0].n)===1);

  await root();
  await c.query('update space_members set share_income=false where space_id=$1 and user_id=$2',[casa,A]);
  await as(B);
  check('A desligou share_income -> B NAO le mais a renda de A',
    Number((await c.query('select count(*) n from incomes where user_id=$1',[A])).rows[0].n)===0);
  await root();
  await c.query('update space_members set share_income=true where space_id=$1 and user_id=$2',[casa,A]);

  console.log('\n-- RECORRENTES / IDEMPOTENCIA --');
  await root();
  await c.query(`insert into recurrences (space_id,created_by,attributed_to,category_id,amount,description,day_of_month,start_date)
    values ($1,$2,null,$3,1800.00,'Aluguel',1,date_trunc('month',current_date))`,[casa,A,cat]);
  const g1=(await c.query('select generate_recurrences() n')).rows[0].n;
  const g2=(await c.query('select generate_recurrences() n')).rows[0].n;
  check('1a execucao gera o aluguel', Number(g1)===1);
  check('2a execucao NAO duplica', Number(g2)===0, 'idempotente');

  console.log(`\n${pass} passaram, ${fail} falharam`);
 } finally { await c.query('rollback'); await c.end(); }
 process.exit(fail?1:0);
})().catch(e=>{console.log('ERRO FATAL:',e.message);process.exit(1)});
