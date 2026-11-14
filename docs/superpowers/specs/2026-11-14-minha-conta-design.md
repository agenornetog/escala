# Minha conta

Aprovado pelo usuário em 14/11/2026.

O rodapé mostra nome, foto e função do usuário conectado. Ao clicar, abre Minha conta para editar nome, enviar/remover foto, consultar e-mail e alterar senha com senha atual, nova senha e confirmação. Funciona para gestores e colaboradores autenticados no Supabase. Perfis usam metadados de apresentação do Auth e fotos em Storage privado com acesso à própria pasta. Permissões continuam derivadas dos vínculos existentes.

Escolha de implementação: janela no rodapé, integrada ao modal existente. Fotos JPEG/PNG/WebP até 2 MB, redimensionadas no navegador. Contas antigas sem nome usam o e-mail até o preenchimento. Sessões locais mantêm identificação e recebem orientação para entrar pela conta da empresa para editar os dados.
