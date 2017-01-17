create table projects (
  id serial primary key,
  user_id int not null references users(id),
  slug varchar(12) not null unique,
  name varchar(120) not null,
  width int not null,
  height int not null,
  layers text not null,
  assets text not null,
  step int not null,
  created_at timestamp not null,
  updated_at timestamp not null
);
