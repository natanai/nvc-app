const recipes = [
  {
    title: 'Chickpea salad',
    slug: 'chickpea-salad',
    category: 'Mains',
    containsGluten: false,
    containsEgg: false,
    containsDairy: false,
  },
  {
    title: 'Pesto pasta',
    slug: 'pesto-pasta',
    category: 'Mains',
    containsGluten: true,
    containsEgg: false,
    containsDairy: true,
  },
  {
    title: 'Berry parfait',
    slug: 'berry-parfait',
    category: 'Desserts',
    containsGluten: false,
    containsEgg: false,
    containsDairy: true,
  },
];

function init() {
  const list = document.getElementById('recipe-list');
  if (!list) return;

  list.innerHTML = '';
  recipes.forEach(recipe => {
    const listItem = document.createElement('li');
    listItem.className = 'recipe-row';

    const link = document.createElement('a');
    link.className = 'recipe-row-link';
    link.href = `./${recipe.slug}/`;

    const title = document.createElement('span');
    title.className = 'recipe-row-title';
    title.textContent = recipe.title;

    const flags = document.createElement('span');
    flags.className = 'recipe-row-flags';
    flags.setAttribute('aria-label', 'Dietary-friendly indicators');

    if (!recipe.containsGluten) {
      flags.appendChild(createFlag('GF', 'Gluten-free'));
    }
    if (!recipe.containsEgg) {
      flags.appendChild(createFlag('EF', 'Egg-free'));
    }
    if (!recipe.containsDairy) {
      flags.appendChild(createFlag('DF', 'Dairy-free'));
    }

    link.append(title, flags);
    listItem.appendChild(link);
    list.appendChild(listItem);
  });
}

function createFlag(label, description) {
  const flag = document.createElement('span');
  flag.className = 'diet-flag';
  flag.textContent = label;
  flag.title = description;
  flag.setAttribute('aria-label', description);
  return flag;
}

document.addEventListener('DOMContentLoaded', init);
